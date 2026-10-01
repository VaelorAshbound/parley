import { describe, expect, test } from "vite-plus/test"

import type { ChatMessage } from "../apps/web/src/server/ai/chat"
import { fullTranscript } from "./runner"

describe("a case's saved transcript", () => {
  test("shows a tool call that failed before it had a valid input", () => {
    // A stored message drops `input: undefined`, as JSON does: a call whose
    // input didn't fit the tool's schema has no input key at all.
    const messages = JSON.parse(
      JSON.stringify([
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-updateFields",
              toolCallId: "call-1",
              state: "output-error",
              input: undefined,
              errorText: "Invalid input for tool updateFields",
            },
          ],
        },
      ])
    ) as ChatMessage[]

    expect(fullTranscript(messages)).toContain(
      "`updateFields` (no valid input)\n  → ERROR Invalid input for tool updateFields"
    )
  })
})
