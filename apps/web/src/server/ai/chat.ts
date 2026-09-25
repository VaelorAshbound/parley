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
import { recent } from "./history"
import { instructions } from "./prompt"
import { answersFor, answersShape } from "./questions"
import { chatTools, runningTools, type ChatTools } from "./tools"

// One chat turn (spec §2 AI design): the user's message (or their answers to
// the AI's questionnaire) goes in, the model's reply streams back over oRPC
// as AI SDK UI message chunks, and both are saved. The browser sends only
// what is new; the history comes from the database, so a client can't
// rewrite what was said.

export type ChatMessage = UIMessage<unknown, UIDataTypes, ChatTools>
type Part = ChatMessage["parts"][number]
type OpenQuestions = Extract<
  Part,
  { type: "tool-askQuestions"; state: "input-available" }
>
type DraftKey = { id: string; userId: string }

/** The longest message a user may send; the reply box stops there too. */
const MAX_MESSAGE = 4000
/**
 * What the model sees of a long chat: its latest messages, up to about 12k
 * tokens. With the instructions, a step stays under ~20k input tokens.
 */
const HISTORY = { messages: 40, characters: 48_000 }
/** A turn may call tools a few times (pick, fill, fix a refusal, reply). */
const STEPS = 8

const userMessage = z.object({
  id: z.string().min(1).max(100),
  role: z.literal("user"),
  parts: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().trim().min(1).max(MAX_MESSAGE),
      })
    )
    .min(1)
    .max(4),
})

/** The stored chat, checked against the current tools; unfit chats start fresh. */
async function history(context: BaseContext, key: DraftKey) {
  const result = await safeValidateUIMessages<ChatMessage>({
    messages: await listMessages(context.db, key),
    tools: chatTools,
  })
  return result.success ? result.data : []
}

function isOpen(part: Part): part is OpenQuestions {
  return part.type === "tool-askQuestions" && part.state === "input-available"
}

/**
 * The message with its open questionnaire closed, when the user wrote in the
 * chat instead of answering: a tool call needs a result before the model
 * sees the chat again. Null when nothing was open.
 */
function closeQuestions(message: ChatMessage | undefined) {
  if (message?.role !== "assistant" || !message.parts.some(isOpen)) return null
  return {
    ...message,
    parts: message.parts.map((part): Part =>
      isOpen(part)
        ? {
            type: part.type,
            toolCallId: part.toolCallId,
            state: "output-error",
            input: part.input,
            errorText:
              "The user replied in the chat instead of answering these questions.",
          }
        : part
    ),
  }
}

/** Streams the model's reply to the chat so far, and saves it when done. */
async function reply({
  context,
  key,
  messages: all,
  today,
  signal,
}: {
  context: BaseContext
  key: DraftKey
  messages: ChatMessage[]
  today: string
  signal: AbortSignal | undefined
}) {
  const messages = recent(all, HISTORY)
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
  const tools = runningTools({ context, draftId: key.id, today })

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
      stepNumber === 0 ? {} : { instructions: instructions(await current()) },
  })

  return streamToEventIterator(
    toUIMessageStream<typeof tools, ChatMessage>({
      stream: result.stream,
      tools,
      // Ending with the assistant's message (after answers), the reply
      // continues that message instead of starting a new one.
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      onEnd: ({ responseMessage }) => {
        // After the response too: the save outlives a closed tab.
        context.waitUntil(saveMessages(context.db, key, [responseMessage]))
      },
    })
  )
}

const turn = z.object({
  id: z.uuid(),
  // The user's own calendar day, for fields that default to today.
  today: z.iso.date(),
})

export const chat = {
  /** The draft's chat, for the page to show and continue. */
  messages: authed
    .input(z.object({ id: z.uuid() }))
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input }) =>
      history(context, { id: input.id, userId: context.user.id })
    ),

  send: authed
    .input(turn.extend({ message: userMessage }))
    .errors({
      MESSAGE_ID_TAKEN: { message: "That message id belongs to Parley." },
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const stored = await history(context, key)
      // Ids come from the browser (useChat makes them): one of Parley's
      // own would let a message stand in for its reply.
      if (
        stored.some(
          (each) => each.id === input.message.id && each.role !== "user"
        )
      )
        throw errors.MESSAGE_ID_TAKEN()
      const closed = closeQuestions(stored.at(-1))
      const earlier = closed ? [...stored.slice(0, -1), closed] : stored
      await saveMessages(
        context.db,
        key,
        closed ? [closed, input.message] : [input.message]
      )
      return reply({
        context,
        key,
        messages: [...earlier, input.message],
        today: input.today,
        signal,
      })
    }),

  /**
   * The user's answers to the AI's open questionnaire (askQuestions, a
   * browser tool). They are checked against the questions asked, saved in
   * that tool call, and the model goes on in the same reply.
   */
  answer: authed
    .input(
      turn.extend({
        toolCallId: z.string().min(1).max(100),
        answers: answersShape.shape.answers,
      })
    )
    .errors({
      NOT_OPEN: { message: "These questions are no longer open." },
      INVALID_ANSWERS: { message: "Those answers don't fit the questions." },
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const stored = await history(context, key)
      const last = stored.at(-1)
      const open = last?.parts.find(
        (part) => isOpen(part) && part.toolCallId === input.toolCallId
      )
      if (last?.role !== "assistant" || !open || !isOpen(open))
        throw errors.NOT_OPEN()
      const checked = answersFor(open.input.questions).safeParse({
        answers: input.answers,
      })
      if (!checked.success) throw errors.INVALID_ANSWERS()

      const answered: ChatMessage = {
        ...last,
        parts: last.parts.map((part): Part =>
          part === open
            ? {
                type: open.type,
                toolCallId: open.toolCallId,
                state: "output-available",
                input: open.input,
                output: answersShape.parse(checked.data),
              }
            : part
        ),
      }
      await saveMessages(context.db, key, [answered])
      return reply({
        context,
        key,
        messages: [...stored.slice(0, -1), answered],
        today: input.today,
        signal,
      })
    }),
}
