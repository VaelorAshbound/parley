import { env } from "cloudflare:workers"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, it, vi } from "vitest"

import {
  browserClient,
  call,
  chatClient,
  cookiesFrom,
  scriptedModel,
  signInGuest,
  type Step,
} from "./helpers"

// T29: the request line through the real /api app in workerd, and what it
// must never hold (spec §9: logs hold IDs and counts only).

const today = "2026-09-25"

/** Everything written to the console while `run` runs, and its result. */
async function captured<T>(run: () => Promise<T>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  using warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  using error = vi.spyOn(console, "error").mockImplementation(() => {})
  const result = await run()
  const calls = [info, warn, error].flatMap((spy) => spy.mock.calls)
  const lines = calls.map(([line]) => line as Record<string, unknown>)
  // Every argument, and errors in full: Workers Logs shows a logged Error's
  // message and stack.
  const text = JSON.stringify(calls, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value
  )
  return { result, calls, lines, text }
}

describe("the request line", () => {
  it("names a guest's sign-in by its route pattern, without the new session's token", async () => {
    const {
      result: response,
      lines,
      text,
    } = await captured(() =>
      call("/api/auth/sign-in/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    )

    expect(lines).toEqual([
      // The audit line (T23): ids only.
      {
        level: "info",
        event: "session_created",
        requestId: expect.any(String),
        userId: expect.any(String),
        sessionId: expect.any(String),
      },
      {
        level: "info",
        event: "request",
        requestId: expect.any(String),
        method: "POST",
        route: "/api/auth/*",
        status: 200,
        latencyMs: expect.any(Number),
      },
    ])
    const token = cookiesFrom(response).split("=")[1] ?? ""
    expect(token.length).toBeGreaterThan(10)
    expect(text).not.toContain(token)
  })

  it("names the procedure and the user's tier, and none of the values sent", async () => {
    const signIn = await call("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const { user } = await signIn.json<{ user: { id: string } }>()
    const client = browserClient(cookiesFrom(signIn))
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const { lines, text } = await captured(() =>
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "purpose", value: "Merging with Zebracorp quietly." }],
      })
    )

    expect(lines).toEqual([
      expect.objectContaining({
        event: "request",
        route: "/api/rpc/drafts/updateFields",
        status: 200,
        tier: "guest",
        userId: user.id,
      }),
    ])
    expect(text).not.toContain("Zebracorp")
  })

  it("keeps the route pattern when a procedure refuses the caller", async () => {
    const { lines } = await captured(() =>
      call("/api/rpc/drafts/list", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
        body: JSON.stringify({ json: {} }),
      })
    )

    expect(lines).toEqual([
      expect.objectContaining({
        event: "request",
        route: "/api/rpc/drafts/list",
        status: 401,
      }),
    ])
    expect(lines[0]).not.toHaveProperty("tier")
  })
})

/**
 * The Worker's env with a database whose every session runs with `setting`
 * (a Postgres run-time parameter): a way to make queries fail on purpose.
 */
function brokenDatabase(setting: string): Env {
  const url = new URL(env.HYPERDRIVE.connectionString)
  url.searchParams.set("options", `-c ${setting}`)
  const hyperdrive: Hyperdrive = Object.create(env.HYPERDRIVE, {
    connectionString: { value: url.toString() },
  })
  return { ...env, HYPERDRIVE: hyperdrive }
}

// Drizzle's error message holds the failed query and its bound values
// (`Failed query: ...\nparams: ...`), so any database failure is where a
// value, chat text or a session token could reach the logs.
describe("a database failure", () => {
  it("logs the error's code, and none of the values the query carried", async () => {
    const { cookie } = await signInGuest()
    const draft = await browserClient(cookie).drafts.create({
      documentId: "mutual-nda",
      today,
    })
    const readOnly = browserClient(
      cookie,
      brokenDatabase("default_transaction_read_only=on")
    )

    const { lines, text } = await captured(() =>
      readOnly.drafts
        .updateFields({
          id: draft.id,
          changes: [
            { key: "purpose", value: "Merging with Zebracorp quietly." },
          ],
        })
        .catch((error: unknown) => error)
    )

    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "rpc_error",
        error: expect.objectContaining({ code: "25006" }),
      })
    )
    expect(text).not.toContain("Zebracorp")
    expect(text).not.toContain("params")
  })

  it("keeps the session token out when the session lookup fails", async () => {
    const signIn = await call("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    // Without the cached session cookie, the session is read from the
    // database, by its token.
    const cookie = cookiesFrom(signIn)
      .split("; ")
      .filter((each) => each.includes("session_token"))
      .join("; ")
    const token = decodeURIComponent(cookie.split("=")[1] ?? "").split(".")[0]
    expect(token?.length).toBeGreaterThan(10)

    const {
      result: response,
      calls,
      text,
    } = await captured(() =>
      call(
        "/api/rpc/drafts/list",
        {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/json",
            "x-csrf-token": "orpc",
          },
          body: JSON.stringify({ json: {} }),
        },
        brokenDatabase("search_path=nowhere")
      )
    )

    expect(response.status).toBe(500)
    // Better Auth's own log of it too, through our logger.
    expect(calls).toContainEqual([
      expect.objectContaining({
        level: "error",
        event: "auth_log",
        error: expect.objectContaining({ code: "42P01" }),
      }),
    ])
    expect(text).not.toContain(token)
    expect(text).not.toContain("params")
  })

  it("keeps a failed sign-in's logs structured and free of query values", async () => {
    const {
      result: response,
      calls,
      text,
    } = await captured(() =>
      call(
        "/api/auth/sign-in/anonymous",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
        brokenDatabase("search_path=nowhere")
      )
    )

    expect(response.status).toBe(500)
    // One structured object per line, as our logger writes them.
    for (const each of calls) {
      expect(each).toHaveLength(1)
      expect(each[0]).toHaveProperty("event")
    }
    expect(text).not.toContain("params")
    expect(text).not.toContain("Failed query")
  })
})

/** A user's message. */
function say(text: string) {
  return {
    id: crypto.randomUUID(),
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  }
}

/** Every chunk of one reply. */
async function read(stream: AsyncIterable<unknown>) {
  const chunks: unknown[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** A guest's NDA draft, with a chat client on the given model. */
async function nda(model: MockLanguageModelV4) {
  const { cookie } = await signInGuest()
  const chat = await chatClient(cookie, model)
  const draft = await chat.client.drafts.create({
    documentId: "mutual-nda",
    today,
  })
  return { ...chat, draft }
}

/** One chat turn to its end, and the log lines it wrote. */
async function turn(model: MockLanguageModelV4, text: string) {
  const { client, settle, draft } = await nda(model)
  const { lines, text: logged } = await captured(async () => {
    await read(
      await client.chat.send({ id: draft.id, message: say(text), today })
    )
    await settle()
  })
  return {
    draft,
    logged,
    lines,
    turns: lines.filter((line) => line.event === "chat_turn"),
  }
}

const fill = (key: string, value: unknown): Step => [
  {
    tool: "updateFields",
    input: { changes: [{ key, value, explanation: "From the chat." }] },
  },
]

describe("the chat's metrics", () => {
  it("log one line per turn with tokens, cost, time to first token and tools", async () => {
    const model = scriptedModel([
      fill("purpose", "Talking about a partnership."),
      [{ text: "Done." }],
    ])

    const { turns, draft } = await turn(model, "We may partner up.")

    expect(turns).toEqual([
      {
        level: "info",
        event: "chat_turn",
        draftId: draft.id,
        userId: draft.userId,
        tier: "guest",
        model: "mock-model-id",
        outcome: "done",
        finishReason: "stop",
        steps: 2,
        inputTokens: 20,
        cachedInputTokens: 0,
        outputTokens: 10,
        costMicroUsd: 40,
        ttftMs: expect.any(Number),
        durationMs: expect.any(Number),
        toolCalls: 1,
        toolErrors: 0,
        rejectedChanges: 0,
      },
    ])
  })

  it("count tool errors by tool, and changes the engine refused", async () => {
    const model = scriptedModel([
      [
        ...fill("party1", { email: "not an email" }),
        {
          tool: "chooseDocument",
          input: { documentId: "no-such-agreement", reason: "Why not." },
        },
      ],
      [{ text: "Let me fix that." }],
    ])

    const { turns } = await turn(model, "Ana's email is not an email.")

    expect(turns[0]).toMatchObject({
      toolCalls: 2,
      toolErrors: 1,
      failedTools: "chooseDocument",
      rejectedChanges: 1,
    })
  })

  it("leave out what was typed and what the model wrote", async () => {
    const model = scriptedModel([
      fill("purpose", "Buying Nightingale Holdings."),
      [{ text: "Noted, the Nightingale deal." }],
    ])

    const { logged } = await turn(model, "We're buying Nightingale Holdings.")

    expect(logged).toContain("chat_turn")
    expect(logged).not.toContain("Nightingale")
  })

  it("log a turn the reader left as aborted, with the steps it finished", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        // One word, then a very slow rest.
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Thinking" },
            { type: "text-delta", id: "t", delta: " about it." },
          ],
          initialDelayInMs: 0,
          chunkDelayInMs: 60_000,
        }),
      }),
    })
    const { client, draft } = await nda(model)
    const tab = new AbortController()
    using info = vi.spyOn(console, "log").mockImplementation(() => {})

    const stream = await client.chat.send(
      { id: draft.id, message: say("Hello?"), today },
      { signal: tab.signal }
    )
    await stream[Symbol.asyncIterator]().next()
    tab.abort()

    await expect
      .poll(() => info.mock.calls.map(([line]) => line))
      .toContainEqual(
        expect.objectContaining({
          event: "chat_turn",
          outcome: "aborted",
          steps: 0,
        })
      )
  })

  it("log a failed turn at error level, with the error's name and none of its text", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Nightingale" },
            {
              type: "error",
              error: new TypeError("Could not parse: Nightingale Holdings"),
            },
          ],
        }),
      }),
    })

    const { logged, turns } = await turn(model, "Hi.")

    expect(turns).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "chat_turn",
        outcome: "error",
        errorName: "TypeError",
      })
    )
    expect(logged).not.toContain("Nightingale")
  })

  it("count what a step used when it fails part way", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Half a" },
            { type: "error", error: new TypeError("Upstream hiccup") },
            {
              type: "finish",
              finishReason: { unified: "error", raw: undefined },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 2, text: 2, reasoning: undefined },
              },
              providerMetadata: { openrouter: { usage: { cost: 0.00001 } } },
            },
          ],
        }),
      }),
    })

    const { turns } = await turn(model, "Hi.")

    expect(turns).toEqual([
      expect.objectContaining({
        level: "error",
        outcome: "error",
        errorName: "TypeError",
        steps: 1,
        inputTokens: 10,
        outputTokens: 2,
        costMicroUsd: 10,
      }),
    ])
  })
})

describe("a reply that can't be saved", () => {
  it("is logged by its draft and the error's code, with none of the chat", async () => {
    // Postgres can't store a NUL character in jsonb, so the save after the
    // reply fails, with the whole reply in Drizzle's error message.
    const model = scriptedModel([[{ text: "Nightingale\u0000 is next." }]])

    const { draft, lines, logged } = await turn(model, "Who's next?")

    expect(lines).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "chat_save_failed",
        draftId: draft.id,
        error: expect.objectContaining({ code: "22P05" }),
      })
    )
    expect(logged).not.toContain("Nightingale")
  })
})
