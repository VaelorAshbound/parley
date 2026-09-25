import { describe, expect, test } from "vite-plus/test"

import type { ChatMessage } from "@/server/ai/chat"

import { answeredCalls, questionsAnswered } from "./transport"

const set = {
  title: "Key terms",
  questions: [
    {
      name: "term",
      prompt: "How long?",
      required: true,
      choices: [{ value: "1y", label: "1 year" }],
      multiple: false,
    },
  ],
}

function reply(...parts: ChatMessage["parts"]): { messages: ChatMessage[] } {
  return { messages: [{ id: "m1", role: "assistant", parts }] }
}

describe("sending automatically", () => {
  test("happens once the questions just asked are answered", () => {
    const answered = reply(
      { type: "step-start" },
      {
        type: "tool-askQuestions",
        toolCallId: "q1",
        state: "output-available",
        input: set,
        output: { answers: { term: ["1y"] } },
      }
    )

    expect(questionsAnswered(answered)).toBe(true)
  })

  test("waits while the questions are open", () => {
    const open = reply(
      { type: "step-start" },
      {
        type: "tool-askQuestions",
        toolCallId: "q1",
        state: "input-available",
        input: set,
      }
    )

    expect(questionsAnswered(open)).toBe(false)
  })

  test("doesn't happen when a turn stopped on a failed tool call", () => {
    const stopped = reply(
      { type: "step-start" },
      {
        type: "tool-askQuestions",
        toolCallId: "q1",
        state: "output-error",
        input: set,
        errorText: "An error occurred.",
      }
    )

    expect(questionsAnswered(stopped)).toBe(false)
  })

  test("doesn't happen again for questions answered earlier in the reply", () => {
    const later = reply(
      { type: "step-start" },
      {
        type: "tool-askQuestions",
        toolCallId: "q1",
        state: "output-available",
        input: set,
        output: { answers: { term: ["1y"] } },
      },
      { type: "step-start" },
      { type: "text", text: "Done.", state: "done" }
    )

    expect(questionsAnswered(later)).toBe(false)
  })

  test("sends the answers to every questionnaire in the last step", () => {
    const answer = (toolCallId: string, term: string) => ({
      type: "tool-askQuestions" as const,
      toolCallId,
      state: "output-available" as const,
      input: set,
      output: { answers: { term: [term] } },
    })
    const [message] = reply(
      answer("q0", "old"),
      { type: "step-start" },
      answer("q1", "1y"),
      answer("q2", "2y")
    ).messages

    expect(message && answeredCalls(message)).toEqual([
      { toolCallId: "q1", answers: { term: ["1y"] } },
      { toolCallId: "q2", answers: { term: ["2y"] } },
    ])
  })
})
