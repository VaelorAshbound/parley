import { describe, expect, test, vi } from "vite-plus/test"
import { renderHook } from "vitest-browser-react"

import type { ChatMessage } from "@/server/ai/chat"

import { useUnfinishedTurn } from "./use-unfinished-turn"

// The wait for a reply the server is still writing (PAR-33), with short
// timings.

const question: ChatMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "Is this mutual?" }],
}
const reply: ChatMessage = {
  id: "reply-1",
  role: "assistant",
  parts: [{ type: "text", text: "Yes." }],
}
const timing = { everyMs: 20, giveUpAfterMs: 200 }

describe("useUnfinishedTurn", () => {
  test("doesn't wait when the chat ends with Parley's reply", async () => {
    const load = vi.fn<() => Promise<ChatMessage[]>>(async () => [
      question,
      reply,
    ])
    const { result } = await renderHook(() =>
      useUnfinishedTurn({
        initialMessages: [question, reply],
        load,
        onReply: () => {},
        timing,
      })
    )

    expect(result.current[0]).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(load).not.toHaveBeenCalled()
  })

  test("hands over the saved chat once the reply is in it", async () => {
    let saved = [question]
    const onReply = vi.fn<(messages: ChatMessage[]) => void>()
    const { result } = await renderHook(() =>
      useUnfinishedTurn({
        initialMessages: [question],
        load: async () => saved,
        onReply,
        timing,
      })
    )
    expect(result.current[0]).toBe("waiting")

    saved = [question, reply]

    await expect.poll(() => result.current[0]).toBeNull()
    expect(onReply).toHaveBeenCalledExactlyOnceWith([question, reply])
  })

  test("keeps waiting through a failed read", async () => {
    let calls = 0
    const onReply = vi.fn<(messages: ChatMessage[]) => void>()
    await renderHook(() =>
      useUnfinishedTurn({
        initialMessages: [question],
        load: async () => {
          calls += 1
          if (calls === 1) throw new Error("offline")
          return [question, reply]
        },
        onReply,
        timing,
      })
    )

    await expect.poll(() => onReply.mock.calls.length).toBe(1)
  })

  test("gives up when no reply comes, so the chat can offer Try again", async () => {
    const { result } = await renderHook(() =>
      useUnfinishedTurn({
        initialMessages: [question],
        load: async () => [question],
        onReply: () => {},
        timing,
      })
    )

    await expect.poll(() => result.current[0]).toBe("lost")
  })
})
