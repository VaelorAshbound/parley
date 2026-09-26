import { dequal } from "dequal/lite"

import type { DocumentDefinition, DraftValues, Fields } from "./define.ts"
import { isRecord } from "./fields/core.ts"
import type { z } from "./zod.ts"

// The one way a draft's values change (spec §5 API): the AI's updateFields
// tool, a manual edit and an undo all come through here.

export type ChangeRequest = {
  key: string
  /** The new value; for object fields, the parts to change. `null` clears. */
  value: unknown
  /**
   * Set on undo: the field must still hold this (`null` = empty), or the
   * change is rejected instead of overwriting a newer edit.
   */
  expected?: unknown
}

export type AppliedChange = { key: string; before: unknown; after: unknown }
/** A reason a change was refused; `path` names the part inside the field. */
export type ChangeIssue = { path: (string | number)[]; message: string }
export type RejectedChange = {
  key: string
  value: unknown
  issues: ChangeIssue[]
}

export type ChangeResult<F extends Fields> = {
  values: DraftValues<F>
  applied: AppliedChange[]
  rejected: RejectedChange[]
  /** Applying these to `values` restores the values before the changes. */
  inverse: ChangeRequest[]
}

/**
 * Applies changes in order. Each is checked on its own: an unknown field, an
 * invalid value or a broken cross-field rule rejects that change only. A
 * change that changes nothing is skipped. The input is never mutated.
 */
export function applyFieldChanges<F extends Fields>(
  definition: DocumentDefinition<F>,
  values: DraftValues<F>,
  changes: readonly ChangeRequest[]
): ChangeResult<F> {
  let current = values
  const applied: AppliedChange[] = []
  const rejected: RejectedChange[] = []
  const inverse: ChangeRequest[] = []

  for (const change of changes) {
    const { key, value } = change
    const reject = (issues: ChangeIssue[]) =>
      rejected.push({ key, value, issues })
    const refuse = (message: string) => reject([{ path: [], message }])

    const field = Object.hasOwn(definition.fields, key)
      ? definition.fields[key]
      : undefined
    if (!field) {
      // Listed, so whoever guessed a key (the AI, T20) can pick a real one.
      refuse(
        `There is no field "${key}". The fields are: ${Object.keys(definition.fields).join(", ")}.`
      )
      continue
    }

    const before: unknown = current[key]
    if ("expected" in change && !dequal(before ?? null, change.expected)) {
      refuse("This field changed after that edit, so it was not undone.")
      continue
    }

    const parsed = value === null ? null : field.changeSchema.safeParse(value)
    if (parsed && !parsed.success) {
      reject(messages(parsed.error.issues, []))
      continue
    }

    const merged = field.merge(before, parsed ? parsed.data : null)
    const { [key]: _old, ...rest } = current
    const next = definition.draftSchema.safeParse(
      merged === undefined ? rest : { ...rest, [key]: merged }
    )
    if (!next.success) {
      reject(messages(next.error.issues, [key]))
      continue
    }

    const after: unknown = next.data[key]
    if (dequal(before, after)) continue

    current = next.data
    applied.push({ key, before, after })
    inverse.unshift({
      key,
      value:
        field.merges === "parts"
          ? partsToRestore(before, after)
          : (before ?? null),
      expected: after ?? null,
    })
  }

  return { values: current, applied, rejected, inverse }
}

/**
 * The change that turns an object field's `after` back into `before`: the old
 * value of each part that differs, and `null` for parts that were empty.
 */
function partsToRestore(before: unknown, after: unknown) {
  if (!isRecord(before)) return null
  if (!isRecord(after)) return before
  const parts = new Set([...Object.keys(before), ...Object.keys(after)])
  return Object.fromEntries(
    [...parts]
      .filter((part) => !dequal(before[part], after[part]))
      .map((part) => [part, before[part] ?? null])
  )
}

/** What a field still needs before the document is complete. */
export type MissingField = ChangeIssue & { key: string }

/**
 * What stops a draft from being a complete document (markComplete, export):
 * each issue of the complete schema, named by its field. Empty when done.
 */
export function missingFields<F extends Fields>(
  definition: DocumentDefinition<F>,
  values: DraftValues<F>
): MissingField[] {
  const result = definition.schema.safeParse(values)
  if (result.success) return []
  return messages(result.error.issues, []).map(
    ({ path: [key, ...path], message }) => ({ key: String(key), path, message })
  )
}

/**
 * The issues, each with its path inside the field: "email" of a party, or
 * none for the whole field (a cross-field rule names the field it blames).
 */
function messages(
  issues: z.core.$ZodIssue[],
  prefix: PropertyKey[]
): ChangeIssue[] {
  return issues.map((issue) => ({
    path: issue.path
      .slice(
        prefix.length > 0 && issue.path[0] === prefix[0] ? prefix.length : 0
      )
      // Zod paths are object keys and array indexes; symbols never occur.
      .filter((part): part is string | number => typeof part !== "symbol"),
    message: issue.message,
  }))
}
