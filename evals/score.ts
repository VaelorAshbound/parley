import type { DocumentId } from "@workspace/documents"

// How an eval conversation is scored (spec §6). Kept apart from the runner
// so its rules are tested without calling a model.

/** Case, spacing and a trailing period don't count: "ceo" is "CEO". */
function normal(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "")
}

/** Each unit in a common one: months for the long units, days for the short. */
const UNITS: Record<string, [base: string, size: number]> = {
  years: ["months", 12],
  quarters: ["months", 3],
  months: ["months", 1],
  weeks: ["days", 7],
  days: ["days", 1],
}

/** A length of time ({ amount, unit }): 12 months is 1 year. */
function isDuration(value: unknown): value is { amount: number; unit: string } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.amount === "number" &&
    typeof value.unit === "string"
  )
}

function inBase({ amount, unit }: { amount: number; unit: string }) {
  const [base, size] = UNITS[unit] ?? [unit, 1]
  return `${amount * size} ${base}`
}

/**
 * Each expected value, down to its parts ("party1.email"), checked against
 * the draft. A list (a multi-choice's `selected`) is one result: the same
 * items in any order. A duration is one result too, in any unit that makes
 * the same length. A court location may leave out "County" or "City", as
 * long as one contains the other; everything else must match.
 */
export function scoreFields(
  expected: Readonly<Record<string, unknown>>,
  actual: Readonly<Record<string, unknown>>
) {
  const results: { path: string; ok: boolean; got: unknown }[] = []
  const walk = (path: string, want: unknown, got: unknown) => {
    if (isRecord(want) && !isDuration(want)) {
      const record = isRecord(got) ? got : {}
      for (const [key, value] of Object.entries(want))
        walk(`${path}.${key}`, value, record[key])
      return
    }
    results.push({ path, ok: same(path, want, got), got })
  }
  for (const [key, value] of Object.entries(expected))
    walk(key, value, actual[key])
  return results
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function same(path: string, want: unknown, got: unknown): boolean {
  if (isDuration(want)) return isDuration(got) && inBase(want) === inBase(got)
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) return false
    // Each wanted item takes one item that matches it, in any order.
    const left = [...got]
    return want.every((item) => {
      const index = left.findIndex((each) => same(path, item, each))
      return index !== -1 && left.splice(index, 1).length === 1
    })
  }
  if (isRecord(want))
    return (
      isRecord(got) &&
      Object.keys(got).length === Object.keys(want).length &&
      Object.entries(want).every(([key, value]) =>
        same(`${path}.${key}`, value, got[key])
      )
    )
  if (typeof want !== "string" || typeof got !== "string") return want === got
  const [a, b] = [normal(want), normal(got)]
  if (path.endsWith(".courtLocation"))
    return a !== "" && b !== "" && (a.includes(b) || b.includes(a))
  return a === b
}

/** How a reply may name each agreement: its name, or its short form. */
const NAMES: Record<DocumentId, RegExp> = {
  "mutual-nda": /\bnon-disclosure agreement\b|\bMNDA\b|\bNDA\b/i,
  csa: /\bcloud service agreement\b|\bCSA\b/i,
  sla: /\bservice level agreement\b|\bSLA\b/i,
  dpa: /\bdata processing agreement\b|\bDPA\b/i,
  "ai-addendum": /\bAI addendum\b/i,
  "pilot-agreement": /\bpilot agreement\b/i,
  "design-partner-agreement": /\bdesign partner agreement\b/i,
  psa: /\bprofessional services agreement\b|\bPSA\b/i,
  "software-license-agreement": /\bsoftware license agreement\b/i,
  "partnership-agreement": /\bpartnership agreement\b/i,
  baa: /\bbusiness associate agreement\b|\bBAA\b/i,
}

/** Which of these agreements the text names, in the order given. */
export function mentioned(text: string, ids: readonly DocumentId[]) {
  return ids.filter((id) => NAMES[id].test(text))
}
