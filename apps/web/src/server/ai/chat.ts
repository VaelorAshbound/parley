import { streamToEventIterator } from "@orpc/server"
import {
  addAiUsage,
  claimMessage,
  deleteMessages,
  getDraft,
  listSavedMessages,
  MessageIdTaken,
  saveMessages,
  type Db,
} from "@workspace/db"
import { definitionOf, type DocumentDefinition } from "@workspace/documents"
import {
  APICallError,
  convertToModelMessages,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIDataTypes,
  type UIMessage,
} from "ai"

import { MAX_MESSAGE } from "../../lib/limits"
import { DAILY_MESSAGES, usageDay } from "../limits"
import {
  currentRequestId,
  log,
  logError,
  logInfo,
  logWarn,
  type LogFields,
} from "../log"
import {
  authed,
  draftOwner,
  perUser,
  tierOf,
  type BaseContext,
  type Tier,
} from "../rpc/base"
import { z } from "../zod"
import { recent } from "./history"
import { turnMetrics, type TurnStep } from "./metrics"
import { instructions } from "./prompt"
import { answersFor, answersShape, type Answers } from "./questions"
import { chatTools, runningTools, type ChatTools } from "./tools"

// One chat turn (spec §2 AI design): the user's message (or their answers to
// the AI's questionnaire) goes in, the model's reply streams back over oRPC
// as AI SDK UI message chunks, and both are saved. The browser sends only
// what is new; the history comes from the database, so a client can't
// rewrite what was said.

/**
 * What the server adds to a stored message: when it was first saved (epoch
 * ms), so a page loaded mid-turn knows whether a reply can still come
 * (PAR-33). Messages the page makes have none.
 */
export type ChatMetadata = { savedAt?: number }
export type ChatMessage = UIMessage<ChatMetadata, UIDataTypes, ChatTools>
type Part = ChatMessage["parts"][number]
type OpenQuestions = Extract<
  Part,
  { type: "tool-askQuestions"; state: "input-available" }
>
type DraftKey = { id: string; userId: string }

/**
 * What the model sees of a long chat: its latest messages, up to about 12k
 * tokens. With the instructions, a step stays under ~20k input tokens.
 */
const HISTORY = { messages: 40, characters: 48_000 }
/** A turn may call tools a few times (pick, fill, fix a refusal, reply). */
const STEPS = 8
/**
 * What one model call may write (ADR-0012). The evals' largest is under
 * 900 tokens a call, so a big questionnaire fits; a prompt that asks for
 * pages of text stops here, at about $0.002 a call.
 */
const MAX_OUTPUT_TOKENS = 4096

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
    // One part, as the reply box sends: MAX_MESSAGE is the whole message.
    .length(1),
})

/** The stored chat, checked against the current tools; unfit chats start fresh. */
async function history(db: Db, key: DraftKey) {
  const stored = await listSavedMessages(db, key)
  const result = await safeValidateUIMessages<ChatMessage>({
    messages: stored.map(({ savedAt, ...each }) => ({
      ...each,
      metadata: { savedAt: savedAt.getTime() },
    })),
    tools: chatTools,
  })
  return result.success ? result.data : []
}

/**
 * The caller's messages today (spec §2 Limits): their tier, the UTC day they
 * count in, and the typed DAILY_LIMIT once they're used up.
 */
type Quota = {
  tier: Tier
  day: string
  limit: number
  /**
   * The error to throw, with one `ai_limit` line: how often each tier runs
   * out is what the limits and Pro are judged by.
   */
  refuse: () => Error
}

function quotaOf(
  user: { id: string; isAnonymous?: boolean | null },
  error: (options: { data: z.infer<typeof DAILY_LIMIT.data> }) => Error
): Quota {
  const tier = tierOf(user)
  const { day, resetsAt } = usageDay()
  const limit = DAILY_MESSAGES[tier]
  return {
    tier,
    day,
    limit,
    refuse: () => {
      logInfo("ai_limit", { userId: user.id, tier, limit })
      return error({ data: { limit, tier, resetsAt } })
    },
  }
}

const DAILY_LIMIT = {
  status: 429,
  message: "You've used today's messages.",
  data: z.object({
    limit: z.number(),
    tier: z.enum(["guest", "free", "pro"]),
    /** When the next day's messages start (UTC midnight), ISO 8601. */
    resetsAt: z.iso.datetime(),
  }),
}

/**
 * Reads the chat and saves what `change` returns under the draft's row lock,
 * so two tabs can't both answer the same questions (or answer while a
 * message closes them). The model's reply streams after, outside the lock.
 *
 * The turn counts toward the day's messages once `change` has accepted it;
 * past the limit, `quota.refuse()` is thrown and nothing is saved or counted.
 * A message id another draft already holds throws `taken()`, and nothing is
 * saved or counted either (PAR-52). `drop` names messages a retry takes
 * back: what a failed turn left (PAR-7).
 */
function lockedChat(
  context: BaseContext,
  key: DraftKey,
  quota: Quota,
  change: (stored: ChatMessage[]) => {
    save: ChatMessage[]
    chat: ChatMessage[]
    drop?: string[]
  },
  taken: () => Error = () => new MessageIdTaken()
) {
  return context.db.transaction(async (tx) => {
    await getDraft(tx, key, { lock: true })
    const { save, chat, drop = [] } = change(await history(tx, key))
    const { day, limit } = quota
    if (!(await claimMessage(tx, { userId: key.userId, day, limit })))
      throw quota.refuse()
    await deleteMessages(tx, key, drop)
    try {
      await saveMessages(tx, key, save)
    } catch (error) {
      throw error instanceof MessageIdTaken ? taken() : error
    }
    return chat
  })
}

type AnsweredQuestions = Extract<
  Part,
  { type: "tool-askQuestions"; state: "output-available" }
>

function isAnswered(part: Part): part is AnsweredQuestions {
  return part.type === "tool-askQuestions" && part.state === "output-available"
}

/** Answers in one order, to compare two sets of them. */
function canonical(answers: Answers) {
  return JSON.stringify(
    Object.entries(answers).toSorted(([a], [b]) => (a < b ? -1 : 1))
  )
}

/**
 * The reply cut back to the end of the step whose questionnaires these
 * answers closed: Try again after an answer turn failed (PAR-7). Null when
 * they aren't all of that step's answers, as saved, or when the reply after
 * them was finished (it ends with a whole text): nothing to retry then.
 */
function retriedAnswers(
  message: ChatMessage,
  calls: readonly { toolCallId: string; answers: Answers }[]
): ChatMessage | null {
  const { parts } = message
  const last = parts.at(-1)
  if (
    message.role !== "assistant" ||
    (last?.type === "text" && last.state === "done")
  )
    return null
  const answeredAt = parts.findLastIndex(isAnswered)
  if (answeredAt === -1) return null
  const start =
    parts.findLastIndex(
      (part, index) => index < answeredAt && part.type === "step-start"
    ) + 1
  const next = parts.findIndex(
    (part, index) => index > answeredAt && part.type === "step-start"
  )
  const end = next === -1 ? parts.length : next
  const answered = parts.slice(start, end).filter(isAnswered)
  const same =
    answered.length === calls.length &&
    answered.every((part) => {
      const sent = calls.find((each) => each.toolCallId === part.toolCallId)
      // Checked as the first time, so they compare as they were saved.
      const checked = answersFor(part.input.questions).safeParse({
        answers: sent?.answers,
      })
      return (
        checked.success &&
        canonical(answersShape.parse(checked.data).answers) ===
          canonical(part.output.answers)
      )
    })
  return same ? { ...message, parts: parts.slice(0, end) } : null
}

/** What a user's message says: its text parts, joined. */
function textOf(message: { parts: readonly { type: string }[] }) {
  return message.parts
    .map((part) => ("text" in part && part.type === "text" ? part.text : ""))
    .join("\n")
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

/**
 * Logs one `chat_turn` line when the turn ends, is left or fails (T29):
 * tokens, cost, time to first token and tool errors, never text. Set up in
 * the request, since the stream's callbacks can run outside its context.
 *
 * `callbacks` go to streamText. `close` runs when the reply stream ends: a
 * turn that failed before any step finished gets no onEnd. `used` gets the
 * turn's numbers once, at the end.
 */
function turnLog(
  key: DraftKey,
  tier: Tier,
  used: (metrics: ReturnType<typeof turnMetrics>) => void
) {
  const started = Date.now()
  const fields = {
    requestId: currentRequestId(),
    draftId: key.id,
    userId: key.userId,
    tier,
  }
  const steps: TurnStep[] = []
  let failure: LogFields | undefined
  let ended = false
  const end = (how: "done" | "aborted") => {
    if (ended) return
    ended = true
    const metrics = turnMetrics(steps)
    log(failure ? "error" : "info", "chat_turn", {
      ...fields,
      ...metrics,
      outcome: failure ? "error" : how,
      durationMs: Date.now() - started,
      ...failure,
    })
    used(metrics)
  }
  return {
    callbacks: {
      onStepEnd: (step: TurnStep) => {
        steps.push(step)
      },
      onEnd: () => end("done"),
      onAbort: () => end("aborted"),
      // Replaces the AI SDK's default, which logs the whole error: its
      // message can hold what the model wrote. The name (and an HTTP
      // status) is enough to find the cause. It runs before the failing
      // step is counted, so the line waits for the end.
      onError: ({ error }: { error: unknown }) => {
        failure ??= {
          errorName: error instanceof Error ? error.name : typeof error,
          errorStatus: APICallError.isInstance(error)
            ? error.statusCode
            : undefined,
        }
      },
    },
    close: () => end("done"),
  }
}

/**
 * Adds a turn's tokens and cost to the user's day in `ai_usage`, after the
 * response. A failure is logged, never thrown: the reply already went out.
 */
function recordUsage(
  context: BaseContext,
  key: DraftKey,
  day: string,
  metrics: ReturnType<typeof turnMetrics>
) {
  if (metrics.steps === 0) return
  context.waitUntil(
    addAiUsage(context.db, {
      userId: key.userId,
      day,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      // Unknown when OpenRouter didn't say; the chat_turn line shows that.
      costMicroUsd: metrics.costMicroUsd ?? 0,
    }).catch((error: unknown) =>
      logError("ai_usage_failed", error, { draftId: key.id })
    )
  )
}

/** A part with nothing to show: a step's start, or a text with no words. */
function isEmptyPart(part: Part) {
  if (part.type === "step-start") return true
  return (
    (part.type === "text" || part.type === "reasoning") &&
    part.text.trim() === ""
  )
}

/** Streams the model's reply to the chat so far, and saves it when done. */
async function reply({
  context,
  key,
  quota,
  messages: all,
  today,
  signal,
}: {
  context: BaseContext
  key: DraftKey
  quota: Quota
  messages: ChatMessage[]
  today: string
  signal: AbortSignal | undefined
}) {
  const metrics = turnLog(key, quota.tier, (used) =>
    recordUsage(context, key, quota.day, used)
  )
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
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // Closing the tab stops the model, and the spend with it.
    abortSignal: signal,
    // Each step sees the draft as the last tool call left it, and a newly
    // chosen agreement's fields.
    prepareStep: async ({ stepNumber }) =>
      stepNumber === 0 ? {} : { instructions: instructions(await current()) },
    ...metrics.callbacks,
  })

  const [toPage, toSave] = toUIMessageStream<typeof tools, ChatMessage>({
    stream: result.stream,
    tools,
    // Ending with the assistant's message (after answers), the reply
    // continues that message instead of starting a new one: the whole
    // stored one, not the model's trimmed view, or the save would cut it.
    originalMessages: all,
    generateMessageId: () => crypto.randomUUID(),
    onEnd: ({ responseMessage }) => {
      metrics.close()
      // A turn stopped before Parley wrote anything leaves nothing to
      // keep: an empty reply would show as a blank bubble, not Try again.
      // A text begun with no word in it yet is nothing too.
      if (responseMessage.parts.every(isEmptyPart)) return
      // After the response too: the save outlives a closed tab. A failure
      // is logged here: uncaught, Workers would log Drizzle's message,
      // which holds the whole reply.
      context.waitUntil(
        saveMessages(context.db, key, [responseMessage]).catch(
          (error: unknown) =>
            logError("chat_save_failed", error, { draftId: key.id })
        )
      )
    },
  }).tee()
  // The save reads its own copy to the end, so a page that leaves (a
  // reload) still gets the reply so far saved: the signal stops the model,
  // its stream ends, and onEnd runs. Read only by the page, the stream just
  // stopped, and nothing was saved (PAR-33).
  // https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#handling-client-disconnects
  context.waitUntil(
    toSave.pipeTo(new WritableStream()).catch(() => {
      // Its failure is the page's too, and logged by onError.
    })
  )
  return streamToEventIterator(toPage)
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
      history(context.db, { id: input.id, userId: context.user.id })
    ),

  send: authed
    .use(perUser("ai"))
    .input(turn.extend({ message: userMessage }))
    .errors({
      MESSAGE_ID_TAKEN: { message: "That message id is already used." },
      DAILY_LIMIT,
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const quota = quotaOf(context.user, errors.DAILY_LIMIT)
      const messages = await lockedChat(
        context,
        key,
        quota,
        (stored) => {
          const index = stored.findIndex((each) => each.id === input.message.id)
          if (index !== -1) {
            // Try again (useChat's regenerate) sends the user's last message
            // again, same id: the turn after it failed. What it left goes,
            // and the model answers that message again (PAR-7). Any other
            // id the chat has is refused: ids come from the browser, and
            // one of Parley's own would let a message stand in for its reply.
            const sent = stored[index]
            const later = stored.slice(index + 1)
            if (
              sent?.role !== "user" ||
              later.some((each) => each.role === "user") ||
              textOf(sent) !== textOf(input.message)
            )
              throw errors.MESSAGE_ID_TAKEN()
            return {
              save: [],
              chat: stored.slice(0, index + 1),
              drop: later.map((each) => each.id),
            }
          }
          const closed = closeQuestions(stored.at(-1))
          const earlier = closed ? [...stored.slice(0, -1), closed] : stored
          return {
            save: closed ? [closed, input.message] : [input.message],
            chat: [...earlier, input.message],
          }
        },
        errors.MESSAGE_ID_TAKEN
      )
      return reply({
        context,
        key,
        quota,
        messages,
        today: input.today,
        signal,
      })
    }),

  /**
   * The user's answers to the AI's open questionnaires (askQuestions, a
   * browser tool; one step may ask more than one). They are checked against
   * the questions asked, saved in those tool calls, and the model goes on in
   * the same reply. Every open questionnaire needs its answers: the model
   * can't see a tool call without a result.
   */
  answer: authed
    .use(perUser("ai"))
    .input(
      turn.extend({
        calls: z
          .array(
            z.object({
              toolCallId: z.string().min(1).max(100),
              answers: answersShape.shape.answers,
            })
          )
          .min(1)
          .max(5),
        /**
         * Try again after an answer turn failed: the same answers, sent
         * again once the questions have closed with them (PAR-7).
         */
        retry: z.boolean().optional(),
      })
    )
    .errors({
      NOT_OPEN: { message: "These questions are no longer open." },
      INVALID_ANSWERS: { message: "Those answers don't fit the questions." },
      DAILY_LIMIT,
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const quota = quotaOf(context.user, errors.DAILY_LIMIT)
      const messages = await lockedChat(context, key, quota, (stored) => {
        const last = stored.at(-1)
        const open = last?.role === "assistant" ? last.parts.filter(isOpen) : []
        if (last && open.length === 0 && input.retry) {
          const retried = retriedAnswers(last, input.calls)
          if (!retried) throw errors.NOT_OPEN()
          return { save: [retried], chat: [...stored.slice(0, -1), retried] }
        }
        const byCall = new Map(
          input.calls.map((each) => [each.toolCallId, each.answers])
        )
        if (
          !last ||
          open.length === 0 ||
          input.calls.some(
            (each) => !open.some((part) => part.toolCallId === each.toolCallId)
          )
        )
          throw errors.NOT_OPEN()
        const outputs = new Map(
          open.map((part) => {
            const checked = answersFor(part.input.questions).safeParse({
              answers: byCall.get(part.toolCallId),
            })
            if (!checked.success) {
              // Which question failed and why, never the answers: a refusal
              // means the browser and the server disagree (a bug to find).
              logWarn("answers_refused", {
                toolCallId: part.toolCallId,
                issues: checked.error.issues
                  .map(
                    ({ path, message }) =>
                      `${path.filter((each) => each !== "answers").join(".")}: ${message}`
                  )
                  .join("; "),
              })
              throw errors.INVALID_ANSWERS()
            }
            return [part.toolCallId, answersShape.parse(checked.data)]
          })
        )
        const answered: ChatMessage = {
          ...last,
          parts: last.parts.map((part): Part => {
            const output = isOpen(part) && outputs.get(part.toolCallId)
            return output
              ? {
                  type: part.type,
                  toolCallId: part.toolCallId,
                  state: "output-available",
                  input: part.input,
                  output,
                }
              : part
          }),
        }
        return { save: [answered], chat: [...stored.slice(0, -1), answered] }
      })
      return reply({
        context,
        key,
        quota,
        messages,
        today: input.today,
        signal,
      })
    }),
}
