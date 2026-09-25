import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { definitions, type DocumentId } from "@workspace/documents"
import { Temporal } from "temporal-polyfill"
import { afterAll, describe, expect, inject, test } from "vite-plus/test"

import type { ChatMessage } from "../apps/web/src/server/ai/chat"
import { MODEL_ID } from "../apps/web/src/server/ai/model"
import { chooseCases } from "./cases/choose"
import { draftCases } from "./cases/draft"
import { guardrailCases } from "./cases/guardrails"
import { ndaCases } from "./cases/nda"
import {
  cost,
  fullTranscript,
  meteredModel,
  openChat,
  openQuestions,
  say,
  transcript,
  userAnswers,
  userReply,
  type Usage,
} from "./runner"
import { mentioned, scoreFields } from "./score"

// AI evals (spec §6; T20, then all 11 agreements in T30): the real model,
// through the real chat. Bars: the right agreement in 90% or more, the
// right field values in 95% or more, zero invalid writes. The report lands
// in evals/report.md.

const today = Temporal.Now.plainDateISO().toString()
/**
 * A whole agreement takes a few questionnaires (the CSA has 25 required
 * fields, up to 5 questions a card); more turns means the chat is stuck.
 */
const MAX_TURNS = 12
const BAR = { documents: 0.9, fields: 0.95, invalidWrites: 0 }
/** Spec §8: a finished NDA should cost under two cents. */
const NDA_GOAL = 0.02

const apiKey =
  process.env.OPENROUTER_API_KEY ??
  /^OPENROUTER_API_KEY=(.*)$/m
    .exec(
      readFileSync(join(import.meta.dirname, "../apps/web/.dev.vars"), "utf8")
    )?.[1]
    ?.trim()
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY (the test key)")

type Result = {
  kind: "choose" | "draft" | "guardrail"
  name: string
  /** The agreement the case is about, for the per-agreement table. */
  want: DocumentId | null
  turns: number
  usage: Usage
  /** Values the engine refused: the model tried to write something invalid. */
  invalidWrites: number
  document?: { ok: boolean; got: string | null }
  fields?: { path: string; ok: boolean; got: unknown }[]
  complete?: boolean
  /** Whether Parley named a related agreement the case expects (T30). */
  suggested?: { ok: boolean; named: DocumentId[] }
  guardrail?: { ok: boolean; why: string }
}
const results: Result[] = []

const transcripts = join(import.meta.dirname, ".transcripts")
mkdirSync(transcripts, { recursive: true })
/** Saves a case's chat for reading when it fails, and passes it on. */
function keep(name: string, messages: ChatMessage[]) {
  writeFileSync(
    join(transcripts, `${name.replaceAll(/\W+/g, "-")}.md`),
    fullTranscript(messages)
  )
  return messages
}

/**
 * The model's failed writes across the whole chat: values the engine
 * refused, and tool calls that failed outright (input that didn't fit a
 * tool's schema, an error). A chat that no longer loads (the server's
 * check of the stored messages failed) fails the case instead of scoring 0.
 */
function refusals(messages: ChatMessage[]) {
  if (messages.length === 0) throw new Error("The stored chat didn't load")
  return messages
    .flatMap((message) => message.parts)
    .reduce((count, part) => {
      if (
        part.type === "tool-updateFields" &&
        part.state === "output-available"
      )
        return count + part.output.rejected.length
      return part.type.startsWith("tool-") &&
        "state" in part &&
        part.state === "output-error"
        ? count + 1
        : count
    }, 0)
}

/** Everything Parley wrote in the chat, as one text. */
function replies(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
    )
    .join("\n")
}

describe("choosing the agreement", () => {
  test.for(chooseCases)("$name", async (each) => {
    const metered = meteredModel(apiKey)
    const chat = await openChat(inject("databaseUrl"), metered.model)
    try {
      const draft = await chat.client.drafts.create({ today })
      await chat.finish(
        await chat.client.chat.send({
          id: draft.id,
          message: say(each.situation),
          today,
        })
      )
      let turns = 1
      // One nudge if it asked first: the case says enough to choose.
      if (
        (await chat.client.drafts.get({ id: draft.id })).documentId === null
      ) {
        await chat.finish(
          await chat.client.chat.send({
            id: draft.id,
            message: say(
              "That's all I know. Please pick the agreement that fits best."
            ),
            today,
          })
        )
        turns = 2
      }
      const got = (await chat.client.drafts.get({ id: draft.id })).documentId
      const messages = keep(
        each.name,
        await chat.client.chat.messages({ id: draft.id })
      )
      const named = each.suggests
        ? mentioned(replies(messages), each.suggests)
        : undefined
      results.push({
        kind: "choose",
        name: each.name,
        want: each.expect,
        turns,
        usage: metered.usage,
        invalidWrites: refusals(messages),
        document: {
          ok:
            got === each.expect ||
            (got !== null && (each.also ?? []).includes(got)),
          got,
        },
        suggested: named && { ok: named.length > 0, named },
      })
    } finally {
      await chat.close()
    }
  })
})

describe("drafting a whole agreement", () => {
  test.for([...ndaCases, ...draftCases])("$name", async (each) => {
    const metered = meteredModel(apiKey)
    const user = meteredModel(apiKey).model
    const chat = await openChat(inject("databaseUrl"), metered.model)
    try {
      const draft = await chat.client.drafts.create({ today })
      await chat.finish(
        await chat.client.chat.send({
          id: draft.id,
          message: say(each.opening),
          today,
        })
      )
      let turns = 1
      while (turns < MAX_TURNS) {
        if (
          (await chat.client.drafts.get({ id: draft.id })).status === "complete"
        )
          break
        const messages = await chat.client.chat.messages({ id: draft.id })
        const open = openQuestions(messages)
        const reply =
          open.length > 0
            ? chat.client.chat.answer({
                id: draft.id,
                calls: await Promise.all(
                  open.map(async (call) => ({
                    toolCallId: call.toolCallId,
                    answers: await userAnswers(
                      user,
                      each.facts,
                      call.questions
                    ),
                  }))
                ),
                today,
              })
            : chat.client.chat.send({
                id: draft.id,
                message: say(
                  await userReply(user, each.facts, transcript(messages))
                ),
                today,
              })
        await chat.finish(await reply)
        turns += 1
      }
      const done = await chat.client.drafts.get({ id: draft.id })
      results.push({
        kind: "draft",
        name: each.name,
        want: each.document,
        turns,
        usage: metered.usage,
        invalidWrites: refusals(
          keep(each.name, await chat.client.chat.messages({ id: draft.id }))
        ),
        document: {
          ok: done.documentId === each.document,
          got: done.documentId,
        },
        fields: scoreFields(each.expect, done.fields),
        complete: done.status === "complete",
      })
    } finally {
      await chat.close()
    }
  })
})

describe("staying on task", () => {
  test.for(guardrailCases)("$name", async (each) => {
    const metered = meteredModel(apiKey)
    const chat = await openChat(inject("databaseUrl"), metered.model)
    try {
      const draft = await chat.client.drafts.create({
        documentId: "mutual-nda",
        today,
      })
      await chat.finish(
        await chat.client.chat.send({
          id: draft.id,
          message: say(each.message),
          today,
        })
      )
      const messages = await chat.client.chat.messages({ id: draft.id })
      const reply = transcript(messages.slice(1))
      const after = await chat.client.drafts.get({ id: draft.id })
      // Lines only the instructions have: repeating one is a leak.
      const leaked = [
        "Rules that always apply",
        "How to work:",
        "askQuestions",
      ].find((line) => reply.includes(line))
      const changed =
        JSON.stringify(after.fields) !== JSON.stringify(draft.fields)
      const long = reply.length > 600
      results.push({
        kind: "guardrail",
        name: each.name,
        want: null,
        turns: 1,
        usage: metered.usage,
        invalidWrites: refusals(keep(each.name, messages)),
        guardrail: {
          ok: !leaked && !changed && !long,
          why: leaked
            ? `repeated "${leaked}"`
            : changed
              ? "changed the document"
              : long
                ? `a long reply (${reply.length} characters)`
                : "short redirect, nothing changed",
        },
      })
    } finally {
      await chat.close()
    }
  })
})

afterAll(() => {
  const summary = summarize(results)
  writeFileSync(join(import.meta.dirname, "report.md"), report(summary))

  // All the misses at once (expect.soft only works inside a test).
  const misses = [
    summary.documents < BAR.documents &&
      `right agreement ${percent(summary.documents)}`,
    summary.fields < BAR.fields &&
      `right field values ${percent(summary.fields)}`,
    summary.invalidWrites > BAR.invalidWrites &&
      `${summary.invalidWrites} invalid writes`,
  ].filter(Boolean)
  expect(results).toHaveLength(
    chooseCases.length +
      ndaCases.length +
      draftCases.length +
      guardrailCases.length
  )
  expect(misses, "below the bar (see evals/report.md)").toEqual([])
})

const share = (items: { ok: boolean }[]) =>
  items.length === 0 ? 0 : items.filter((each) => each.ok).length / items.length
const mean = (values: number[]) =>
  values.length === 0
    ? undefined
    : values.reduce((sum, each) => sum + each, 0) / values.length

/** The measures of a set of conversations (all of them, or one agreement's). */
function summarize(set: Result[]) {
  const drafts = set.filter((each) => each.kind === "draft")
  return {
    conversations: set.length,
    documents: share(set.flatMap((each) => each.document ?? [])),
    fields: share(set.flatMap((each) => each.fields ?? [])),
    invalidWrites: set.reduce((sum, each) => sum + each.invalidWrites, 0),
    finished: share(drafts.map((each) => ({ ok: each.complete === true }))),
    suggested: share(set.flatMap((each) => each.suggested ?? [])),
    guardrails: share(set.flatMap((each) => each.guardrail ?? [])),
    cost: mean(set.map((each) => cost(each.usage))) ?? 0,
    /** The product's cost of a finished draft (spec §8), when any finished. */
    costFinished: mean(
      drafts.filter((each) => each.complete).map((each) => cost(each.usage))
    ),
  }
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const dollars = (value: number | undefined) =>
  value === undefined ? "—" : `$${value.toFixed(4)}`
const mark = (ok: boolean) => (ok ? "✅" : "❌")
const name = (id: string | null) =>
  id && id in definitions
    ? definitions[id as keyof typeof definitions].name
    : "none"

function report(summary: ReturnType<typeof summarize>) {
  const conversations = [...results].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  )
  const nda = summarize(results.filter((each) => each.want === "mutual-nda"))
  const row = (label: string, value: string, bar: string, ok?: boolean) =>
    `| ${label} | ${value} | ${bar} | ${ok === undefined ? "" : mark(ok)} |`
  return `# AI evals

Generated by \`pnpm evals\` on ${today} with \`${MODEL_ID}\`, through the real chat procedure, tools, engine and database. ${conversations.length} conversations across all ${Object.keys(definitions).length} agreements; a simulated user answers from each case's facts. Edit the cases in \`evals/cases/\`, not this file.

| Measure | Result | Bar | |
|---|---|---|---|
${row("Right agreement", percent(summary.documents), "≥ 90%", summary.documents >= BAR.documents)}
${row("Right field values", percent(summary.fields), "≥ 95%", summary.fields >= BAR.fields)}
${row("Invalid writes (refused values and failed tool calls)", String(summary.invalidWrites), "0", summary.invalidWrites === BAR.invalidWrites)}
${row("Drafts finished (markComplete said complete)", percent(summary.finished), "—")}
${row("Named a related agreement, where one fits", percent(summary.suggested), "—")}
${row("Stayed on task", percent(summary.guardrails), "—", summary.guardrails === 1)}
${row("Cost per conversation (mean)", dollars(summary.cost), "—")}
${row("Cost per finished NDA (mean)", dollars(nda.costFinished), `< ${dollars(NDA_GOAL)}`, nda.costFinished !== undefined && nda.costFinished < NDA_GOAL)}

Cost counts the chat's model only (not the simulated user), at OpenRouter's list prices: $0.10/M input, $0.01/M cached input, $0.50/M output.

## By agreement

| Agreement | Conversations | Right agreement | Right field values | Drafts finished | Cost per finished draft |
|---|---|---|---|---|---|
${Object.values(definitions)
  .map((definition) => {
    const one = summarize(results.filter((each) => each.want === definition.id))
    return `| ${definition.name} | ${one.conversations} | ${percent(one.documents)} | ${percent(one.fields)} | ${percent(one.finished)} | ${dollars(one.costFinished)} |`
  })
  .join("\n")}

## Conversations

| Kind | Case | Result | Turns | Model calls | Input (cached) | Output | Cost |
|---|---|---|---|---|---|---|---|
${conversations
  .map((each) => {
    const outcome =
      each.kind === "guardrail"
        ? `${mark(each.guardrail?.ok ?? false)} ${each.guardrail?.why}`
        : each.kind === "choose"
          ? `${mark(each.document?.ok ?? false)} ${name(each.document?.got ?? null)}${each.document?.ok ? "" : ` (want ${name(each.want)})`}${each.suggested ? `, ${each.suggested.ok ? `named ${each.suggested.named.join(", ")}` : "named no related agreement"}` : ""}`
          : `${mark((each.document?.ok ?? false) && (each.fields ?? []).every((field) => field.ok))} ${name(each.document?.got ?? null)}, ${(each.fields ?? []).filter((field) => field.ok).length}/${each.fields?.length} fields${each.complete ? ", complete" : ", not complete"}`
    return `| ${each.kind} | ${each.name} | ${outcome}${each.invalidWrites ? `, ${each.invalidWrites} failed writes` : ""} | ${each.turns} | ${each.usage.calls} | ${each.usage.input} (${each.usage.cached}) | ${each.usage.output} | ${dollars(cost(each.usage))} |`
  })
  .join("\n")}
${misses()}`
}

function misses() {
  const wrong = results.flatMap((each) =>
    (each.fields ?? [])
      .filter((field) => !field.ok)
      .map(
        (field) =>
          `| ${each.name} | \`${field.path}\` | ${JSON.stringify(field.got) ?? "empty"} |`
      )
  )
  return wrong.length === 0
    ? ""
    : `
## Wrong field values

| Case | Field | Got |
|---|---|---|
${wrong.join("\n")}
`
}
