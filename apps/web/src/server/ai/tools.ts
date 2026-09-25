import { createTool } from "@orpc/ai-sdk"
import {
  definitions,
  type ChangeIssue,
  type DocumentId,
} from "@workspace/documents"
import { tool, type InferUITools } from "ai"

import type { BaseContext } from "../rpc/base"
import { drafts } from "../rpc/drafts"
import { z } from "../zod"
import { answersShape, isShown, questionSet } from "./questions"

// The chat's tools (spec §2 AI design). The server ones run the draft
// procedures through oRPC's createTool, so the AI and the manual editor share
// one input schema, one ownership check and one applyFieldChanges. The model
// never sends the draft id; the chat fills it in.

const ids = Object.keys(definitions)
const isId = (id: string): id is DocumentId => ids.includes(id)

const change = z.object({
  key: z.string().max(100).describe("The field's key."),
  value: z
    .unknown()
    .describe(
      "The new value, shaped as the field's schema says; null clears it."
    ),
  explanation: z
    .string()
    .max(300)
    .describe("What this value means, in one short plain sentence."),
})

// Stored as JSON, which drops an undefined value: an empty field's `before`
// (or a cleared field's `after`) is simply missing.
const applied = z.object({
  key: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  explanation: z.string(),
})
const issue = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
})
const request = z.object({
  key: z.string(),
  value: z.unknown().optional(),
  expected: z.unknown().optional(),
})

const updateFieldsSpec = {
  description:
    "Set or clear fields of the chosen agreement. Each change is checked on its own; refused ones come back with the reason.",
  inputSchema: z.object({ changes: z.array(change).min(1).max(20) }),
  outputSchema: z.object({
    applied: z.array(applied),
    rejected: z.array(
      z.object({
        key: z.string(),
        value: z.unknown().optional(),
        issues: z.array(issue),
      })
    ),
    /** Applying these undoes the applied changes (T18's Undo). */
    inverse: z.array(request),
  }),
}

const chooseDocumentSpec = {
  description:
    "Choose the agreement for this draft, or switch to another one. Values that fit the new agreement are kept.",
  inputSchema: z.object({
    documentId: z.enum(ids).describe("The agreement's id from the list."),
    reason: z
      .string()
      .max(300)
      .describe("Why it fits, in one short plain sentence."),
  }),
  outputSchema: z.object({ documentId: z.string(), title: z.string() }),
}

const markCompleteSpec = {
  description:
    "Check that every required field holds a valid value, and mark the agreement complete. Call it when nothing required is empty; otherwise it lists what is missing.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    complete: z.boolean(),
    missing: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      })
    ),
  }),
}

// Runs in the browser: no execute here. The turn pauses on the call, the
// questionnaire shows it, and chat.answer brings the checked answers back.
const askQuestionsSpec = {
  description:
    "Ask the user a short set of related questions as a questionnaire card in the chat. The answers come back as this tool's result.",
  inputSchema: questionSet,
  outputSchema: answersShape,
  // Each question with the labels picked, the words typed, or a skip. The
  // user's words stay JSON strings, so they read as data.
  toModelOutput: ({
    input,
    output,
  }: {
    input: z.input<typeof questionSet>
    output: z.infer<typeof answersShape>
  }) => ({
    type: "json" as const,
    value: input.questions
      .filter((question) => isShown(question, output.answers))
      .map((question) => {
        const values = output.answers[question.name]
        if (!values) return { question: question.name, skipped: true }
        const label = (value: string) =>
          question.choices.find((option) => option.value === value)?.label
        return {
          question: question.name,
          picked: values.flatMap((value) => label(value) ?? []),
          typed: values.filter((value) => label(value) === undefined),
        }
      }),
  }),
}

/**
 * The tools' shapes, without their execution: stored chats are checked
 * against them, and the client's message type is inferred from them.
 */
export const chatTools = {
  updateFields: tool(updateFieldsSpec),
  chooseDocument: tool(chooseDocumentSpec),
  markComplete: tool(markCompleteSpec),
  askQuestions: tool(askQuestionsSpec),
}

export type ChatTools = InferUITools<typeof chatTools>

type Turn = {
  context: BaseContext
  draftId: string
  /** The user's own calendar day, for fields that default to today. */
  today: string
}

export function runningTools({ context, draftId, today }: Turn) {
  const update = createTool(drafts.updateFields, { context })
  const choose = createTool(drafts.chooseDocument, { context })
  const complete = createTool(drafts.markComplete, { context })
  // The AI SDK runs a step's tool calls side by side, but this request has
  // one database connection: two transactions on it would interleave and
  // each would overwrite the other's changes. So they take turns, in the
  // order the model made them.
  let queue: Promise<unknown> = Promise.resolve()
  const inTurn = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run)
    queue = next.catch(() => undefined)
    return next
  }

  return {
    askQuestions: tool(askQuestionsSpec),
    updateFields: tool({
      ...updateFieldsSpec,
      execute: ({ changes: sent }, options) =>
        inTurn(async () => {
          if (!update.execute) throw new Error("updateFields has no procedure")
          const changes = folded(sent)
          const result = await last(
            update.execute(
              {
                id: draftId,
                changes: changes.map(({ key, value }) => ({ key, value })),
              },
              options
            )
          )
          const why = new Map(
            changes.map((each) => [each.key, each.explanation])
          )
          return {
            applied: result.applied.map((each) => ({
              ...each,
              explanation: why.get(each.key) ?? "",
            })),
            rejected: result.rejected,
            inverse: result.inverse,
          }
        }),
      // The model needs the new values and the refusals, not the undo data.
      // As text: field values are plain JSON, but typed as unknown.
      toModelOutput: ({ output }) => ({
        type: "text",
        value: JSON.stringify({
          applied: output.applied.map(({ key, after }) => ({
            key,
            value: after ?? null,
          })),
          rejected: output.rejected.map(({ key, issues }) => ({
            key,
            issues: issues.map(describe),
          })),
        }),
      }),
    }),
    chooseDocument: tool({
      ...chooseDocumentSpec,
      execute: ({ documentId }, options) =>
        inTurn(async () => {
          if (!choose.execute)
            throw new Error("chooseDocument has no procedure")
          if (!isId(documentId))
            throw new Error(`Unknown agreement ${documentId}`)
          const draft = await last(
            choose.execute({ id: draftId, documentId, today }, options)
          )
          return { documentId, title: draft.title }
        }),
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          ...output,
          note: "The agreement's fields and current values are now in your instructions.",
        },
      }),
    }),
    markComplete: tool({
      ...markCompleteSpec,
      execute: (_input, options) =>
        inTurn(async () => {
          if (!complete.execute)
            throw new Error("markComplete has no procedure")
          return last(complete.execute({ id: draftId }, options))
        }),
      // "Party 2: Fill this in." for each gap, or the next step.
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.complete
          ? "The agreement is complete. Tell the user in one line that it is complete and they can read it through next to the chat. Export is not available yet: never offer it."
          : `Not complete yet. Missing: ${output.missing
              .map(
                ({ key, label, path, message }) =>
                  // The key and part to write, not only the label: the
                  // model guessed keys like "party1Title" without them.
                  `${[label, ...path].join(" ")}: ${message} (key "${key}"${path.length > 0 ? ` with {"${path[0]}": …}` : ""})`
              )
              .join("; ")}`,
      }),
    }),
  }
}

/**
 * The changes with each part written as a path ("party1.company", the form
 * the app's own field paths use, and one the model reaches for) folded
 * into its field: { key: "party1", value: { company: … } }. Parts of one
 * field in a row become one change, so they apply together.
 */
function folded(changes: z.infer<typeof change>[]) {
  const out: z.infer<typeof change>[] = []
  for (const each of changes) {
    // One level only; anything deeper goes on as sent, for the engine to
    // refuse with the list of real keys.
    const [key = each.key, part, ...deeper] = each.key.split(".")
    if (part === undefined || deeper.length > 0) {
      out.push(each)
      continue
    }
    const previous = out.at(-1)
    const merged =
      previous?.key === key &&
      typeof previous.value === "object" &&
      previous.value !== null
        ? { ...previous.value, [part]: each.value }
        : undefined
    // New objects each time: the model's own input is kept as it sent it.
    if (previous && merged)
      out[out.length - 1] = {
        key,
        value: merged,
        explanation: `${previous.explanation} ${each.explanation}`.trim(),
      }
    else out.push({ ...each, key, value: { [part]: each.value } })
  }
  return out
}

/**
 * A tool's result. Tools may stream partial results (an AsyncIterable); a
 * procedure answers once, so this takes its one, final value.
 */
async function last<T>(result: T | PromiseLike<T> | AsyncIterable<T>) {
  const value = await result
  if (!isStream(value)) return value
  let final: T | undefined
  for await (const each of value) final = each
  if (final === undefined) throw new Error("The tool gave no result")
  return final
}

function isStream<T>(value: T | AsyncIterable<T>): value is AsyncIterable<T> {
  return (
    typeof value === "object" && value !== null && Symbol.asyncIterator in value
  )
}

/** "email: Use a real email address." */
function describe(issue: ChangeIssue) {
  return issue.path.length > 0
    ? `${issue.path.join(".")}: ${issue.message}`
    : issue.message
}
