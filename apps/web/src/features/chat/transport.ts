import { eventIteratorToUnproxiedDataStream } from "@orpc/client"
import type { ChatTransport } from "ai"
import { Temporal } from "temporal-polyfill"

import type { Orpc } from "@/lib/orpc"
import type { ChatMessage } from "@/server/ai/chat"

// useChat over oRPC (spec §2 AI): the chat.send procedure streams UI message
// chunks as an event iterator, turned back into the stream useChat reads.
// Only the new message is sent; the server keeps the history.
// https://orpc.dev/docs/integrations/ai-sdk
export function chatTransport(orpc: Orpc): ChatTransport<ChatMessage> {
  return {
    async sendMessages({ chatId, messages, abortSignal }) {
      const message = messages.at(-1)
      if (message?.role !== "user")
        throw new Error("Only a user's message is sent")
      const stream = await orpc.chat.send.call(
        {
          id: chatId,
          message: {
            id: message.id,
            role: "user",
            parts: message.parts.flatMap((part) =>
              part.type === "text"
                ? [{ type: "text" as const, text: part.text }]
                : []
            ),
          },
          today: Temporal.Now.plainDateISO().toString(),
        },
        { signal: abortSignal }
      )
      // Unproxied: the AI SDK structuredClones chunks, and oRPC may proxy them.
      return eventIteratorToUnproxiedDataStream(stream)
    },
    // A turn that was cut off isn't resumed; its saved part shows on reload.
    reconnectToStream: async () => null,
  }
}
