import { Temporal } from "temporal-polyfill"

// Who may download what (spec §2 Quota, Limits). A document counts on its
// first export; free users get 3 counted documents per calendar month
// (UTC), Pro users have no limit, and exporting a counted document again is
// always free. Word files need Pro. The database side (the per-user lock
// and the counts) is in rpc/export.ts.

export const FREE_DOCUMENTS_PER_MONTH = 3

export type Plan = "free" | "pro"
export type ExportFormat = "pdf" | "docx"

/**
 * The user's plan. Everyone is on Free until T26 reads the Polar
 * subscription here.
 */
export function planOf(_user: { id: string }): Plan {
  return "free"
}

/** The first moment of the calendar month (UTC) that `now` is in. */
export function monthStart(now: Temporal.Instant): Temporal.Instant {
  return now.toZonedDateTimeISO("UTC").with({ day: 1 }).startOfDay().toInstant()
}

export type ExportDecision =
  | { ok: true; counts: boolean }
  | { ok: false; error: "PRO_REQUIRED" | "QUOTA_EXCEEDED" }

export function decideExport({
  plan,
  format,
  counted,
  usedThisMonth,
}: {
  plan: Plan
  format: ExportFormat
  /** The document was exported before (it has `firstExportedAt`). */
  counted: boolean
  /** Documents the user has had counted this calendar month. */
  usedThisMonth: number
}): ExportDecision {
  if (format === "docx" && plan !== "pro")
    return { ok: false, error: "PRO_REQUIRED" }
  if (counted) return { ok: true, counts: false }
  if (plan === "free" && usedThisMonth >= FREE_DOCUMENTS_PER_MONTH)
    return { ok: false, error: "QUOTA_EXCEEDED" }
  return { ok: true, counts: true }
}
