import {
  countExportsSince,
  getDraft,
  lockExports,
  recordExport,
  type Db,
  type Draft,
} from "@workspace/db"
import { definitionOf, missingFields } from "@workspace/documents"
import { Temporal } from "temporal-polyfill"

import { buildFile, PrintFailed, type PrintPdf } from "../files"
import { log } from "../log"
import {
  decideExport,
  FREE_DOCUMENTS_PER_MONTH,
  monthStart,
  planOf,
  type ExportFormat,
  type Plan,
} from "../quota"
import { z } from "../zod"
import { draftOwner, perUser, verified } from "./base"

// Download a draft as a PDF or a Word file (T24, spec §2 Quota). Only a
// confirmed email may export (`verified`), so fake addresses can't use up
// the free documents.
//
// Order of work: refuse early (plan, quota, an unfinished draft) without
// spending Browser Run time; build the file; then count it under the user's
// lock and hand it over. Counting last means a failed print never costs a
// free document, and the lock means two downloads at once can't both take
// the last one. A file built but then refused (the other request won) costs
// one Browser Run print, a fraction of a cent.

type Missing = { key: string; label: string }

export type ExportOutcome =
  | { ok: true; file: File; counted: boolean; browserMs: number | undefined }
  | {
      ok: false
      error: "PRO_REQUIRED" | "QUOTA_EXCEEDED" | "NOT_FOUND" | "NO_DOCUMENT"
    }
  | { ok: false; error: "INCOMPLETE"; missing: Missing[] }

/** The export itself, apart from the procedure, so tests can pick the plan. */
export async function exportDraft({
  db,
  printPdf,
  userId,
  draft,
  format,
  plan,
  now,
  signal,
}: {
  db: Db
  printPdf: PrintPdf
  userId: string
  draft: Draft
  format: ExportFormat
  plan: Plan
  now: Temporal.Instant
  /** The request's: a user who left before the file was ready isn't charged. */
  signal?: AbortSignal | undefined
}): Promise<ExportOutcome> {
  const since = new Date(monthStart(now).epochMilliseconds)
  const decide = async (tx: Db, counted: boolean) =>
    decideExport({
      plan,
      format,
      counted,
      usedThisMonth: await countExportsSince(tx, { userId, since }),
    })

  const early = await decide(db, draft.firstExportedAt !== null)
  if (!early.ok) return early
  if (draft.documentId === null) return { ok: false, error: "NO_DOCUMENT" }
  const definition = definitionOf(draft.documentId)
  const values = definition.draftSchema.parse(draft.fields)
  const missing = missingFields(definition, values)
  if (missing.length > 0)
    return {
      ok: false,
      error: "INCOMPLETE",
      // One entry per field, even when several of its parts are missing.
      missing: [...new Set(missing.map(({ key }) => key))].map((key) => ({
        key,
        label: definition.fields[key]?.label ?? key,
      })),
    }

  const { file, browserMs } = await buildFile(
    format,
    { title: draft.title, definition, values },
    printPdf
  )

  // Nobody is waiting for the file any more: don't count it.
  signal?.throwIfAborted()
  const key = { id: draft.id, userId }
  const claimed = await db.transaction(async (tx) => {
    await lockExports(tx, userId)
    const fresh = await getDraft(tx, key)
    if (!fresh) return { ok: false as const, error: "NOT_FOUND" as const }
    const decision = await decide(tx, fresh.firstExportedAt !== null)
    if (!decision.ok) return decision
    if (decision.counts)
      await recordExport(tx, key, new Date(now.epochMilliseconds))
    return decision
  })
  if (!claimed.ok) return claimed
  return { ok: true, file, counted: claimed.counts, browserMs }
}

const input = z.object({ id: z.uuid() })

const errors = {
  NO_DOCUMENT: { status: 409, message: "Pick an agreement first." },
  INCOMPLETE: {
    status: 409,
    message: "Fill in the rest of the agreement first.",
    data: z.object({
      missing: z.array(z.object({ key: z.string(), label: z.string() })),
    }),
  },
  PRO_REQUIRED: { status: 402, message: "Word files come with Pro." },
  QUOTA_EXCEEDED: {
    status: 402,
    message: `You have downloaded your ${FREE_DOCUMENTS_PER_MONTH} free documents this month.`,
    data: z.object({ limit: z.number() }),
  },
  EXPORT_FAILED: {
    status: 503,
    message: "We couldn't make the file just now. Please try again.",
  },
}

function download(format: ExportFormat) {
  return verified
    .use(perUser("export"))
    .input(input)
    .errors(errors)
    .use(draftOwner, ({ id }) => id)
    .handler(async ({ context, errors, signal }) => {
      const plan = planOf(context.user)
      const started = Date.now()
      const fields = {
        draftId: context.draft.id,
        userId: context.user.id,
        tier: plan,
        format,
      }
      let outcome: ExportOutcome
      try {
        outcome = await exportDraft({
          db: context.db,
          printPdf: context.printPdf,
          userId: context.user.id,
          draft: context.draft,
          format,
          plan,
          now: Temporal.Now.instant(),
          signal,
        })
      } catch (error) {
        // Leaving (closing the tab) is not a failure; nobody waits for the
        // answer then.
        const aborted = signal?.aborted === true
        log(
          aborted ? "info" : "error",
          "export",
          {
            ...fields,
            outcome: aborted ? "aborted" : "failed",
            status: error instanceof PrintFailed ? error.status : undefined,
            durationMs: Date.now() - started,
          },
          aborted ? undefined : error
        )
        throw errors.EXPORT_FAILED({ cause: error })
      }
      // Refusals are logged too: how often people hit the paywall is the
      // number the upgrade page is judged by.
      log("info", "export", {
        ...fields,
        outcome: outcome.ok ? "done" : outcome.error,
        durationMs: Date.now() - started,
        ...(outcome.ok && {
          counted: outcome.counted,
          browserMs: outcome.browserMs,
          bytes: outcome.file.size,
        }),
      })
      if (outcome.ok) return outcome.file
      switch (outcome.error) {
        case "INCOMPLETE":
          throw errors.INCOMPLETE({ data: { missing: outcome.missing } })
        case "QUOTA_EXCEEDED":
          throw errors.QUOTA_EXCEEDED({
            data: { limit: FREE_DOCUMENTS_PER_MONTH },
          })
        default:
          throw errors[outcome.error]()
      }
    })
}

export const exports = {
  pdf: download("pdf"),
  docx: download("docx"),
}
