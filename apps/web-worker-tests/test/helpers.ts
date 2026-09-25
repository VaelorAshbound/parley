import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins"
import type { RouterClient } from "@orpc/server"
import { connect, schema } from "@workspace/db"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { simulateReadableStream, type LanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterAll, expect, onTestFinished } from "vitest"

import { api } from "../../web/src/server/api"
import { createAuth } from "../../web/src/server/auth"
import type { PrintFailed, PrintPdf } from "../../web/src/server/files"
import type { Router } from "../../web/src/server/rpc/router"
import { createServerClient } from "../../web/src/server/rpc/server-client"
import { passingToken } from "./siteverify"

export const origin = "http://localhost:3000"

/**
 * One request through the real /api app, as the browser would send it.
 * `bindings` replaces the Worker's env (a broken database, say).
 */
export async function call(
  path: string,
  init: RequestInit = {},
  bindings: Env = env
) {
  const headers = new Headers(init.headers)
  if (!headers.has("origin")) headers.set("origin", origin)
  // Every real HTTP request has one; Better Auth builds its URL from it.
  if (!headers.has("host")) headers.set("host", new URL(origin).host)
  // Each call is its own client, as far as the rate limiter can tell.
  if (!headers.has("cf-connecting-ip"))
    headers.set("cf-connecting-ip", randomIp())
  // A solved Turnstile challenge, as the sign-up and sign-in forms send it.
  if (!headers.has("x-captcha-response"))
    headers.set("x-captcha-response", passingToken)
  const ctx = createExecutionContext()
  const response = await api.fetch(
    new Request(origin + path, { ...init, headers }),
    bindings,
    ctx
  )
  await waitOnExecutionContext(ctx)
  return response
}

/** The browser's client, over HTTP through the real /api app. */
export function browserClient(
  cookie: string,
  bindings: Env = env
): RouterClient<Router> {
  return createORPCClient(
    new RPCLink({
      url: `${origin}/api/rpc`,
      headers: { cookie },
      plugins: [new SimpleCsrfProtectionLinkPlugin()],
      fetch: async (request) =>
        call(
          new URL(request.url).pathname + new URL(request.url).search,
          {
            method: request.method,
            headers: request.headers,
            body: request.method === "GET" ? null : await request.text(),
          },
          bindings
        ),
    })
  )
}

/** A JSON POST, as Better Auth's browser client sends it. */
export function post(path: string, body: unknown, cookie?: string) {
  return call(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify(body),
  })
}

/** The test database, to set up or check rows; closed after the test. */
export async function database() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  return db
}

/** The audit lines' events (server/audit.ts), each about one user. */
export const auditEvents = new Set([
  "session_created",
  "session_ended",
  "login_method_added",
  "email_changed",
  "password_changed",
  "password_reset",
  "user_deleted",
])

/** The Cookie header a browser would send back after this response. */
export function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

/** A new guest, as the first visit that needs a session makes one. */
export async function signInGuest() {
  const response = await call("/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  expect(response.status).toBe(200)
  return { cookie: cookiesFrom(response) }
}

/**
 * A new email + password account, signed in, email not confirmed. The
 * address is on a test domain, so no email is sent. Pass a guest's cookie to
 * sign up as that guest.
 */
export async function signUpUser(guestCookie?: string) {
  const email = `ana-${crypto.randomUUID()}@example.test`
  const response = await call("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(guestCookie && { cookie: guestCookie }),
    },
    body: JSON.stringify({ name: "Ana", email, password: "correct horse 1" }),
  })
  expect(response.status).toBe(200)
  return { email, cookie: cookiesFrom(response) }
}

/**
 * A new email + password account with its email confirmed, as if the link
 * in the email was opened: it may export (spec §2 Limits).
 */
export async function signUpVerified() {
  const account = await signUpUser()
  const db = await connect(env.HYPERDRIVE.connectionString)
  try {
    await db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.email, account.email))
  } finally {
    await db.$client.end()
  }
  return account
}

/** What the fake PDF printer answers with. */
export const FAKE_PDF = "%PDF-1.7 fake"

/**
 * A stand-in for Browser Run in the RPC context: records each page it was
 * asked to print, and answers with FAKE_PDF, or fails when told to.
 */
export function fakePrinter(fail?: PrintFailed) {
  const pages: string[] = []
  const printPdf: PrintPdf = async (html) => {
    pages.push(html)
    if (fail) throw fail
    return { bytes: await new Response(FAKE_PDF).arrayBuffer(), browserMs: 180 }
  }
  return { printPdf, pages }
}

/**
 * A stand-in for the Worker's BROWSER binding, for requests through the
 * real /api app: Browser Run's quickAction() has no local simulator.
 */
export function fakeBrowserBinding(status = 200) {
  const pages: string[] = []
  const BROWSER = {
    quickAction: async (_action: "pdf", options: { html: string }) => {
      pages.push(options.html)
      return status === 200
        ? new Response(FAKE_PDF, {
            headers: {
              "content-type": "application/pdf",
              "x-browser-ms-used": "180",
            },
          })
        : Response.json({ success: false }, { status })
    },
  } as unknown as BrowserRun
  return { bindings: { ...env, BROWSER }, pages }
}

/** Calls procedures in-process with the given cookie (or none), like SSR. */
export async function serverClient(cookie?: string) {
  return (await chatClient(cookie, scriptedModel([[{ text: "Hi." }]]))).client
}

/**
 * Like serverClient, with the chat's model given. `settle` waits for the
 * work left after the response (saving the reply), as the Worker would.
 */
export async function chatClient(
  cookie: string | undefined,
  model: LanguageModel,
  printPdf: PrintPdf = fakePrinter().printPdf
) {
  const db = await connect(env.HYPERDRIVE.connectionString)
  const ctx = createExecutionContext()
  const reqHeaders = new Headers({ host: "localhost:3000" })
  if (cookie) reqHeaders.set("cookie", cookie)
  // Kept here too: an execution context can be waited on only once.
  const later: Promise<unknown>[] = []
  const waitUntil = (promise: Promise<unknown>) => {
    later.push(promise)
    ctx.waitUntil(promise)
  }
  const client = createServerClient({
    db,
    auth: createAuth({ db, env, waitUntil }),
    model,
    printPdf,
    waitUntil,
    reqHeaders,
    resHeaders: new Headers(),
  })
  // A real Worker's request ends and takes its socket with it; these
  // in-process clients don't, and a run once ran the test Postgres out of
  // connections. Each closes after its test (and its pending saves), or
  // after its file when made while the file is collected (the auth matrix).
  const close = async () => {
    await Promise.allSettled(later)
    await db.$client.end()
  }
  if (expect.getState().currentTestName === undefined) afterAll(close)
  else onTestFinished(close)
  return { client, settle: () => Promise.all(later.splice(0)) }
}

/** What a model streams, from the mock's own types (no provider package). */
type StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV4["doStream"]>
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never

/** One model step: some text and/or tool calls, in order. */
export type Step = ({ text: string } | { tool: string; input: unknown })[]

/**
 * A scripted model (AI SDK MockLanguageModelV4): each call streams the next
 * step, using 10 input and 5 output tokens and costing $0.00002. Its
 * `doStreamCalls` show what the model was sent.
 */
export function scriptedModel(steps: Step[]) {
  let call = 0
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(call, steps.length - 1)] ?? []
      call += 1
      const calls = step.some((part) => "tool" in part)
      return {
        stream: simulateReadableStream({
          chunks: [
            ...step.flatMap((part, index): StreamPart[] =>
              "text" in part
                ? [
                    { type: "text-start", id: `t${index}` },
                    { type: "text-delta", id: `t${index}`, delta: part.text },
                    { type: "text-end", id: `t${index}` },
                  ]
                : [
                    {
                      type: "tool-call",
                      toolCallId: `call-${call}-${index}`,
                      toolName: part.tool,
                      input: JSON.stringify(part.input),
                    },
                  ]
            ),
            {
              type: "finish",
              finishReason: {
                unified: calls ? "tool-calls" : "stop",
                raw: undefined,
              },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 5, text: 5, reasoning: undefined },
              },
              // What OpenRouter charged for the call, in dollars, as its
              // provider reports it.
              providerMetadata: { openrouter: { usage: { cost: 0.00002 } } },
            },
          ],
        }),
      }
    },
  })
}

function randomIp() {
  const [a = 0, b = 0, c = 0] = crypto.getRandomValues(new Uint8Array(3))
  return `10.${a}.${b}.${c}`
}
