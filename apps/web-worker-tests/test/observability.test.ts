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
  const lines = [info, warn, error].flatMap((spy) =>
    spy.mock.calls.map(([line]) => line as Record<string, unknown>)
  )
  // Errors in full: Workers Logs shows a logged Error's message and stack.
  const text = JSON.stringify(lines, (_key, value: unknown) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value
  )
  return { result, lines, text }
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

    const { logged } = await turn(model, "Hi.")

    expect(JSON.parse(logged)).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "chat_turn",
        outcome: "error",
        errorName: "TypeError",
      })
    )
    expect(logged).not.toContain("Nightingale")
  })
})
