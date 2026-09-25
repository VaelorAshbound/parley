// How an eval conversation is scored (spec §6). Kept apart from the runner
// so its rules are tested without calling a model.

/** Case, spacing and a trailing period don't count: "ceo" is "CEO". */
function normal(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "")
}

/**
 * Each expected value, down to its parts ("party1.email"), checked against
 * the draft. A court location may leave out "County" or "City", as long as
 * one contains the other; everything else must match.
 */
export function scoreFields(
  expected: Readonly<Record<string, unknown>>,
  actual: Readonly<Record<string, unknown>>
) {
  const results: { path: string; ok: boolean; got: unknown }[] = []
  const walk = (path: string, want: unknown, got: unknown) => {
    if (typeof want === "object" && want !== null && !Array.isArray(want)) {
      const record = typeof got === "object" && got !== null ? got : {}
      for (const [key, value] of Object.entries(want))
        walk(`${path}.${key}`, value, (record as Record<string, unknown>)[key])
      return
    }
    results.push({ path, ok: same(path, want, got), got })
  }
  for (const [key, value] of Object.entries(expected))
    walk(key, value, actual[key])
  return results
}

function same(path: string, want: unknown, got: unknown) {
  if (typeof want !== "string" || typeof got !== "string") return want === got
  const [a, b] = [normal(want), normal(got)]
  if (path.endsWith(".courtLocation")) return a.includes(b) || b.includes(a)
  return a === b
}
