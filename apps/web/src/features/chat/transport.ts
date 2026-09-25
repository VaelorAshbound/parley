import { eventIteratorToUnproxiedDataStream } from "@orpc/client"
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatTransport,
} from "ai"
import { Temporal } from "temporal-polyfill"

import type { Orpc } from "@/lib/orpc"
import type { ChatMessage } from "@/server/ai/chat"

// useChat over oRPC (spec §2 AI): the chat procedures stream UI message
// chunks as an event iterator, turned back into the stream useChat reads.
// Only what is new is sent, the user's message or their answers to the AI's
// questions; the server keeps the history.
// https://orpc.dev/docs/integrations/ai-sdk
export function chatTransport(orpc: Orpc): ChatTransport<ChatMessage> {
  return {
    async sendMessages({ chatId, messages, abortSignal }) {
      const message = messages.at(-1)
      const today = Temporal.Now.plainDateISO().toString()
      const stream =
        message?.role === "assistant"
          ? // Sent by sendAutomaticallyWhen once the questions are answered.
            await orpc.chat.answer.call(
              { id: chatId, today, ...answered(message) },
              { signal: abortSignal }
            )
          : await orpc.chat.send.call(
              { id: chatId, today, message: userMessage(message) },
              { signal: abortSignal }
            )
      // Unproxied: the AI SDK structuredClones chunks, and oRPC may proxy them.
      return eventIteratorToUnproxiedDataStream(stream)
    },
    // A turn that was cut off isn't resumed; its saved part shows on reload.
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

/** The questions just answered: the last ones answered in the reply. */
function answered(message: ChatMessage) {
  const part = message.parts.findLast(
    (each) =>
      each.type === "tool-askQuestions" && each.state === "output-available"
  )
  if (part?.type !== "tool-askQuestions" || part.state !== "output-available")
    throw new Error("No answers to send")
  return { toolCallId: part.toolCallId, answers: part.output.answers }
}

/**
 * useChat's sendAutomaticallyWhen: the AI's questions in the reply's last
 * step were just answered. The AI SDK's helper alone would also fire when a
 * turn stopped on a failed tool call, with no answers to send.
 */
export function questionsAnswered({ messages }: { messages: ChatMessage[] }) {
  const message = messages.at(-1)
  if (message?.role !== "assistant") return false
  const step = message.parts.slice(
    message.parts.findLastIndex((part) => part.type === "step-start") + 1
  )
  return (
    step.some(
      (part) =>
        part.type === "tool-askQuestions" && part.state === "output-available"
    ) && lastAssistantMessageIsCompleteWithToolCalls({ messages })
  )
}
