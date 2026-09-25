import { streamToEventIterator } from "@orpc/server"
import { getDraft, listMessages, saveMessages } from "@workspace/db"
import { definitionOf, type DocumentDefinition } from "@workspace/documents"
import {
  convertToModelMessages,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIDataTypes,
  type UIMessage,
} from "ai"

import { authed, draftOwner, type BaseContext } from "../rpc/base"
import { z } from "../zod"
import { instructions } from "./prompt"
import { chatTools, runningTools, type ChatTools } from "./tools"

// One chat turn (spec §2 AI design): the user's message goes in, the model's
// reply streams back over oRPC as AI SDK UI message chunks, and both are
// saved. The browser sends only its new message; the history comes from the
// database, so a client can't rewrite what was said.

export type ChatMessage = UIMessage<unknown, UIDataTypes, ChatTools>

/** Only the model's recent turns are sent; T19 sets the final limits. */
const HISTORY = 40
/** A turn may call tools a few times (pick, fill, fix a refusal, reply). */
const STEPS = 8

const userMessage = z.object({
  id: z.string().min(1).max(100),
  role: z.literal("user"),
  parts: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(4),
})

/** The stored chat, checked against the current tools; unfit chats start fresh. */
async function history(
  context: BaseContext,
  key: { id: string; userId: string }
) {
  const result = await safeValidateUIMessages<ChatMessage>({
    messages: await listMessages(context.db, key),
    tools: chatTools,
  })
  return result.success ? result.data : []
}

export const chat = {
  /** The draft's chat, for the page to show and continue. */
  messages: authed
    .input(z.object({ id: z.uuid() }))
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input }) =>
      history(context, { id: input.id, userId: context.user.id })
    ),

  send: authed
    .input(
      z.object({
        id: z.uuid(),
        message: userMessage,
        // The user's own calendar day, for fields that default to today.
        today: z.iso.date(),
      })
    )
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const messages: ChatMessage[] = [
        ...(await history(context, key)).slice(-HISTORY),
        input.message,
      ]
      await saveMessages(context.db, key, [input.message])

      const base: BaseContext = context
      const current = async () => {
        const draft = await getDraft(context.db, key)
        const definition: DocumentDefinition | null = draft?.documentId
          ? definitionOf(draft.documentId)
          : null
        return {
          definition,
          values: definition?.draftSchema.parse(draft?.fields ?? {}) ?? {},
        }
      }
      const tools = runningTools({
        context: base,
        draftId: input.id,
        today: input.today,
      })

      const result = streamText({
        model: context.model,
        instructions: instructions(await current()),
        messages: await convertToModelMessages(messages, { tools }),
        tools,
        stopWhen: isStepCount(STEPS),
        // Closing the tab stops the model, and the spend with it.
        abortSignal: signal,
        // Each step sees the draft as the last tool call left it, and a newly
        // chosen agreement's fields.
        prepareStep: async ({ stepNumber }) =>
          stepNumber === 0
            ? {}
            : { instructions: instructions(await current()) },
      })

      return streamToEventIterator(
        toUIMessageStream<typeof tools, ChatMessage>({
          stream: result.stream,
          tools,
          originalMessages: messages,
          generateMessageId: () => crypto.randomUUID(),
          onEnd: ({ responseMessage }) => {
            // After the response too: the save outlives a closed tab.
            context.waitUntil(saveMessages(context.db, key, [responseMessage]))
          },
        })
      )
    }),
}
