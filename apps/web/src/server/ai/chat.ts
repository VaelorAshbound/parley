import { streamToEventIterator } from "@orpc/server"
import {
  addAiUsage,
  claimMessage,
  deleteMessages,
  endTurn,
  getDraft,
  listSavedMessages,
  MessageIdTaken,
  saveMessages,
  startTurn,
  turnOf,
  type Db,
  type Turn,
} from "@workspace/db"
import { definitionOf, type DocumentDefinition } from "@workspace/documents"
import {
  APICallError,
  convertToModelMessages,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"

import { answeredStep } from "../../lib/answered-step"
import { MAX_MESSAGE, TURN_LIFETIME_MS } from "../../lib/limits"
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
/**
 * What the server adds to a reply's parts. `interrupted` ends a reply cut
 * short by Stop or a reload (PAR-47), so a later visit can say so. It rides
 * in the stored parts (the message table has no metadata), and the model
 * never sees it: data parts aren't converted for it.
 */
const dataSchemas = { interrupted: z.object({}) }
export type ChatData = {
  [name in keyof typeof dataSchemas]: z.infer<(typeof dataSchemas)[name]>
}
export type ChatMessage = UIMessage<ChatMetadata, ChatData, ChatTools>
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
    dataSchemas,
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

/** A retry while the turn it retries may still answer (PAR-7). */
const TURN_RUNNING = {
  status: 409,
  message: "Parley is still answering.",
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
 * Where the draft's latest turn is (PAR-7): still "running", ended "done",
 * or "failed" (an error, a stop, or a reader that left; one older than a
 * turn can last never got to say, so it failed too). Null for a chat whose
 * turns began before turns were kept.
 */
type TurnState = "running" | "done" | "failed" | null

function stateOf(turn: Turn | null, now: number): TurnState {
  if (!turn) return null
  if (turn.outcome) return turn.outcome
  return now - turn.startedAt < TURN_LIFETIME_MS ? "running" : "failed"
}

/**
 * Reads the chat and saves what `change` returns under the draft's row lock,
 * so two tabs can't both answer the same questions (or answer while a
 * message closes them). The model's reply streams after, outside the lock.
 * `change` also gets where the latest turn is, so a retry can wait for it.
 *
 * The turn counts toward the day's messages once `change` has accepted it;
 * past the limit, `quota.refuse()` is thrown and nothing is saved or counted.
 * A message id already taken (another draft's, PAR-52) throws `taken()`,
 * and nothing is saved or counted either. `drop` names messages a retry
 * takes back: what a failed turn left (PAR-7).
 *
 * The accepted turn becomes the draft's latest; its id comes back with the
 * chat, for the reply's save.
 */
function lockedChat(
  context: BaseContext,
  key: DraftKey,
  quota: Quota,
  change: (
    stored: ChatMessage[],
    latest: TurnState
  ) => {
    save: ChatMessage[]
    chat: ChatMessage[]
    drop?: string[]
  },
  taken: () => Error
) {
  return context.db.transaction(async (tx) => {
    await getDraft(tx, key, { lock: true })
    const latest = stateOf(await turnOf(tx, key), Date.now())
    const { save, chat, drop = [] } = change(await history(tx, key), latest)
    const { day, limit } = quota
    if (!(await claimMessage(tx, { userId: key.userId, day, limit })))
      throw quota.refuse()
    await deleteMessages(tx, key, drop)
    const turn = crypto.randomUUID()
    try {
      await saveMessages(tx, key, save)
      await startTurn(tx, key, { id: turn, startedAt: Date.now() })
    } catch (error) {
      throw error instanceof MessageIdTaken ? taken() : error
    }
    return { chat, turn }
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
 * they aren't all of that step's answers, as saved. Whether the turn after
 * them failed is the caller's to know (the turn record, not the reply).
 */
function retriedAnswers(
  message: ChatMessage,
  calls: readonly { toolCallId: string; answers: Answers }[]
): ChatMessage | null {
  const { parts } = message
  if (message.role !== "assistant") return null
  const step = answeredStep(parts)
  if (!step) return null
  const answered = parts.slice(step.start, step.end).filter(isAnswered)
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
  // A reply stopped right after the answers ends with its mark (PAR-47):
  // the retry is running, not stopped.
  return same
    ? { ...message, parts: markedParts(parts.slice(0, step.end), false) }
    : null
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
  let stopped = false
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
      onAbort: () => {
        stopped = true
        end("aborted")
      },
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
    /** How the turn ended, once it has: a stop counts as failed. */
    outcome: (): "done" | "failed" => (failure || stopped ? "failed" : "done"),
    /** Whether the reader left (Stop, a reload) before the reply ended. */
    stopped: () => stopped && !failure,
    fields,
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

/** Marks the end of a reply cut short (PAR-47). */
const INTERRUPTED: Part = { type: "data-interrupted", data: {} }

/**
 * The reply's parts, without a mark from an earlier save (a reply its
 * answers carried on), and marked when this turn was stopped.
 */
function markedParts(parts: readonly Part[], stopped: boolean) {
  const own = parts.filter((part) => part.type !== INTERRUPTED.type)
  return stopped ? [...own, INTERRUPTED] : own
}

/**
 * Ends the turn and keeps its reply, under the draft's row lock: only while
 * it is still the draft's latest turn (PAR-7). A later one (a retry once
 * this one looked lost, or another tab's message) began from a chat without
 * this reply, so keeping it would put a reply nobody asked for in the chat.
 */
async function endTurnWith(
  context: BaseContext,
  key: DraftKey,
  turn: string,
  outcome: "done" | "failed",
  response: ChatMessage | undefined,
  stopped: boolean,
  fields: LogFields
) {
  await context.db.transaction(async (tx) => {
    await getDraft(tx, key, { lock: true })
    if (!(await endTurn(tx, key, turn, outcome))) {
      logWarn("chat_turn_superseded", { ...fields, outcome })
      return
    }
    // A turn stopped before Parley wrote anything leaves nothing to keep:
    // an empty reply would show as a blank bubble, not Try again. A text
    // begun with no word in it yet is nothing too.
    if (response && !response.parts.every(isEmptyPart))
      await saveMessages(tx, key, [
        { ...response, parts: markedParts(response.parts, stopped) },
      ])
  })
}

/** Streams the model's reply to the chat so far, and saves it when done. */
async function reply({
  context,
  key,
  quota,
  messages: all,
  turn,
  today,
  signal,
}: {
  context: BaseContext
  key: DraftKey
  quota: Quota
  messages: ChatMessage[]
  /** The turn lockedChat began. */
  turn: string
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
      response = responseMessage
    },
  }).tee()
  let response: ChatMessage | undefined
  // The save reads its own copy to the end, so a page that leaves (a
  // reload) still gets the reply so far saved: the signal stops the model,
  // its stream ends, and onEnd runs. Read only by the page, the stream just
  // stopped, and nothing was saved (PAR-33). However the stream ends, the
  // turn ends with it (PAR-7): a failed one can be tried again at once.
  // After the response too: the save outlives a closed tab. A failure is
  // logged here: uncaught, Workers would log Drizzle's message, which holds
  // the whole reply.
  // https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#handling-client-disconnects
  context.waitUntil(
    toSave
      .pipeTo(new WritableStream())
      .then(
        () => metrics.outcome(),
        // Its failure is the page's too, and logged by onError.
        () => "failed" as const
      )
      .then((outcome) =>
        endTurnWith(
          context,
          key,
          turn,
          outcome,
          response,
          metrics.stopped(),
          metrics.fields
        )
      )
      .catch((error: unknown) =>
        logError("chat_save_failed", error, { draftId: key.id })
      )
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
      TURN_RUNNING,
      DAILY_LIMIT,
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const quota = quotaOf(context.user, errors.DAILY_LIMIT)
      const { chat: messages, turn } = await lockedChat(
        context,
        key,
        quota,
        (stored, latest) => {
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
            // Its first run may still answer: two replies would stay.
            if (latest === "running") throw errors.TURN_RUNNING()
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
        turn,
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
      TURN_RUNNING,
      DAILY_LIMIT,
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors, signal }) => {
      const key = { id: input.id, userId: context.user.id }
      const quota = quotaOf(context.user, errors.DAILY_LIMIT)
      const { chat: messages, turn } = await lockedChat(
        context,
        key,
        quota,
        (stored, latest) => {
          const last = stored.at(-1)
          const open =
            last?.role === "assistant" ? last.parts.filter(isOpen) : []
          // The answers given before, when the failed turn asked more
          // after them, are a retry too: they aren't these open ones.
          const answering = input.calls.every((each) =>
            open.some((part) => part.toolCallId === each.toolCallId)
          )
          if (last && input.retry && !answering) {
            // Only a turn that failed is tried again: one still running would
            // answer twice, and a finished one has nothing to retry.
            if (latest === "running") throw errors.TURN_RUNNING()
            const retried =
              latest === "failed" ? retriedAnswers(last, input.calls) : null
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
              (each) =>
                !open.some((part) => part.toolCallId === each.toolCallId)
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
        },
        // Only the draft's own last reply is saved again here; an id it
        // can't keep means the chat changed under the answers.
        errors.NOT_OPEN
      )
      return reply({
        context,
        key,
        quota,
        messages,
        turn,
        today: input.today,
        signal,
      })
    }),
}
