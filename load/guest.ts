// A guest who chats with a Preview over HTTP, the way the browser does
// (Better Auth's anonymous sign-in, then oRPC). For the performance scripts
// (T35); the e2e tests do the same in e2e/helpers.ts.
import { isFirstToken } from "./measure.ts"

/** Cloudflare's "always passes" test widget token; Previews use its keys. */
const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"

/** The browser's CSRF header for oRPC (SimpleCsrfProtectionLinkPlugin). */
const RPC_HEADERS = {
  "content-type": "application/json",
  "x-csrf-token": "orpc",
}

export type Guest = { base: string; cookie: string }

/**
 * Signs a new guest in. New guests are rate limited per IP, so on a 429 it
 * waits as long as the server says and tries again.
 */
export async function newGuest(
  base: string,
  { scriptedAi = true }: { scriptedAi?: boolean } = {}
): Promise<Guest> {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const response = await fetch(`${base}/api/auth/sign-in/anonymous`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: base,
        "x-captcha-response": TURNSTILE_TEST_TOKEN,
      },
      body: "{}",
    })
    if (response.ok) {
      const session = response.headers
        .getSetCookie()
        .map((each) => each.split(";")[0])
      // The cookie that asks a Preview for the scripted AI (free, the same
      // every run). Without it a Preview uses the real model, and it costs.
      if (scriptedAi) session.push("parley-scripted-ai=1")
      return { base, cookie: session.join("; ") }
    }
    if (response.status !== 429)
      throw new Error(`Guest sign-in failed: ${response.status}`)
    const wait = Number(response.headers.get("x-retry-after") ?? 1)
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
  }
  throw new Error("Guest sign-in: still rate limited after 20 tries")
}

async function rpc(guest: Guest, path: string, input: unknown) {
  return fetch(`${guest.base}/api/rpc/${path}`, {
    method: "POST",
    headers: { ...RPC_HEADERS, cookie: guest.cookie },
    body: JSON.stringify({ json: input }),
  })
}

const today = () => new Date().toISOString().slice(0, 10)

/** A new, empty draft (the chat picks the agreement). Returns its id. */
export async function newDraft(guest: Guest): Promise<string> {
  const response = await rpc(guest, "drafts/create", { today: today() })
  if (!response.ok) throw new Error(`drafts.create: ${response.status}`)
  const { json } = (await response.json()) as { json: { id: string } }
  return json.id
}

export type Turn = {
  status: number
  /** From sending the message to the model's first text or tool call. */
  firstTokenMs: number | null
  totalMs: number
}

/** Sends one chat message and reads the whole streamed reply. */
export async function sendTurn(
  guest: Guest,
  draftId: string,
  text: string
): Promise<Turn> {
  const started = performance.now()
  const response = await rpc(guest, "chat/send", {
    id: draftId,
    today: today(),
    message: {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    },
  })
  let firstTokenMs: number | null = null
  if (response.body) {
    const decoder = new TextDecoder()
    let buffered = ""
    for await (const bytes of response.body) {
      buffered += decoder.decode(bytes, { stream: true })
      const lines = buffered.split("\n")
      buffered = lines.pop() ?? ""
      for (const line of lines) {
        if (firstTokenMs !== null || !line.startsWith("data: ")) continue
        const chunk = parseChunk(line.slice("data: ".length))
        if (chunk && isFirstToken(chunk))
          firstTokenMs = performance.now() - started
      }
    }
  }
  return {
    status: response.status,
    firstTokenMs,
    totalMs: performance.now() - started,
  }
}

/** One SSE `data:` line of oRPC's event stream: `{"json": chunk}`. */
function parseChunk(data: string): { type: string } | null {
  try {
    const { json } = JSON.parse(data) as { json?: { type?: unknown } }
    return typeof json?.type === "string" ? { type: json.type } : null
  } catch {
    return null
  }
}

/** What /api/version says: the commit, and whether the scripted AI is on. */
export async function version(base: string) {
  const response = await fetch(`${base}/api/version`)
  if (!response.ok) throw new Error(`/api/version: ${response.status}`)
  return (await response.json()) as { commit: string; scriptedAi: boolean }
}
