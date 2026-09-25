import { describe, expect, it, vi } from "vitest"

import { browserClient, signInGuest } from "./helpers"

// A chat turn through the real /api app (T29): the other chat tests call the
// procedures in-process, where there is no request and so no request id.
// Here the /api app builds the model, so its module is swapped for a
// scripted one.

vi.mock(import("../../web/src/server/ai/model"), async (original) => {
  const { simulateReadableStream } = await import("ai")
  const { MockLanguageModelV4 } = await import("ai/test")
  return {
    ...(await original()),
    createModel: () =>
      new MockLanguageModelV4({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: "Hello." },
              { type: "text-end", id: "t" },
              {
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage: {
                  inputTokens: {
                    total: 10,
                    noCache: 10,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 5, text: 5, reasoning: undefined },
                },
              },
            ],
          }),
        }),
      }),
  }
})

describe("a chat turn over /api", () => {
  it("logs its chat_turn line with the request's id", async () => {
    const { cookie } = await signInGuest()
    const client = browserClient(cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today: "2026-09-25",
    })
    using info = vi.spyOn(console, "log").mockImplementation(() => {})

    const stream = await client.chat.send({
      id: draft.id,
      message: {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "Hi." }],
      },
      today: "2026-09-25",
    })
    for await (const _chunk of stream);

    const lines = info.mock.calls.map(
      ([line]) => line as { event: string; requestId?: string }
    )
    const request = lines.find((line) => line.event === "request")
    const turn = lines.find((line) => line.event === "chat_turn")
    expect(request).toMatchObject({
      route: "/api/rpc/chat/send",
      requestId: expect.any(String),
    })
    expect(turn).toMatchObject({
      outcome: "done",
      requestId: request?.requestId,
    })
  })
})
