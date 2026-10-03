import { eventIteratorToUnproxiedDataStream } from "@orpc/client"
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatTransport,
} from "ai"
import { Temporal } from "temporal-polyfill"

import { answeredStep } from "@/lib/answered-step"
import type { Orpc } from "@/lib/orpc"
import type { ChatMessage } from "@/server/ai/chat"

// useChat over oRPC (spec §2 AI): the chat procedures stream UI message
// chunks as an event iterator, turned back into the stream useChat reads.
// Only what is new is sent, the user's message or their answers to the AI's
// questions; the server keeps the history.
// https://orpc.dev/docs/integrations/ai-sdk
export function chatTransport(orpc: Orpc): ChatTransport<ChatMessage> {
  return {
    async sendMessages({ chatId, messages, abortSignal, body }) {
      const message = messages.at(-1)
      const today = Temporal.Now.plainDateISO().toString()
      const stream =
        message?.role === "assistant"
          ? // Sent by sendAutomaticallyWhen once the questions are answered,
            // or by Try again after that turn failed (`retry`, PAR-7).
            await orpc.chat.answer.call(
              {
                id: chatId,
                today,
                calls: answeredCalls(message),
                retry:
                  body !== undefined && "retry" in body && body.retry === true,
              },
              { signal: abortSignal }
            )
          : await orpc.chat.send.call(
              { id: chatId, today, message: userMessage(message) },
              { signal: abortSignal }
            )
      // Unproxied: the AI SDK structuredClones chunks, and oRPC may proxy them.
      return eventIteratorToUnproxiedDataStream(stream)
    },
    // A stream isn't resumed: a page loaded mid-reply waits for the saved
    // reply instead (use-unfinished-turn.ts).
    reconnectToStream: async () => null,
  }
}

function userMessage(message: ChatMessage | undefined) {
  if (message?.role !== "user") throw new Error("Only a user's message is sent")
  return {
    id: message.id,
    role: "user" as const,
    parts: message.parts.flatMap((part) =>
      part.type === "text" ? [{ type: "text" as const, text: part.text }] : []
    ),
  }
}

/**
 * The questionnaires just answered: every one in the reply's last step (a
 * step may ask more than one; chat.answer needs them all).
 */
export function answeredCalls(message: ChatMessage) {
  return lastStep(message).flatMap((part) =>
    part.type === "tool-askQuestions" && part.state === "output-available"
      ? [{ toolCallId: part.toolCallId, answers: part.output.answers }]
      : []
  )
}

/**
 * The reply as it was when its last questions were answered, for Try again
 * after that answer turn failed (PAR-7): what the failed turn wrote after
 * them goes, new questions too, and the answers are sent again. Null when
 * the reply has no answered questions: then the turn to retry is the user's
 * message.
 */
export function answersToRetry(message: ChatMessage): ChatMessage | null {
  if (message.role !== "assistant") return null
  const step = answeredStep(message.parts)
  // A reply stopped right after the answers ends with its Stopped mark
  // (PAR-47): the retry is running, not stopped.
  return (
    step && {
      ...message,
      parts: message.parts
        .slice(0, step.end)
        .filter((part) => part.type !== "data-interrupted"),
    }
  )
}

function lastStep(message: ChatMessage) {
  return message.parts.slice(
    message.parts.findLastIndex((part) => part.type === "step-start") + 1
  )
}

/**
 * useChat's sendAutomaticallyWhen: the AI's questions in the reply's last
 * step were just answered. The AI SDK's helper alone would also fire when a
 * turn stopped on a failed tool call, with no answers to send.
 */
export function questionsAnswered({ messages }: { messages: ChatMessage[] }) {
  const message = messages.at(-1)
  if (message?.role !== "assistant") return false
  return (
    answeredCalls(message).length > 0 &&
    lastAssistantMessageIsCompleteWithToolCalls({ messages })
  )
}
