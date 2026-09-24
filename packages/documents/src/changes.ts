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
export type RejectedChange = { key: string; value: unknown; issues: string[] }

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
    const reject = (issues: string[]) => rejected.push({ key, value, issues })

    const field = Object.hasOwn(definition.fields, key)
      ? definition.fields[key]
      : undefined
    if (!field) {
      reject([`There is no field "${key}".`])
      continue
    }

    const before: unknown = current[key]
    if ("expected" in change && !dequal(before ?? null, change.expected)) {
      reject(["This field changed after that edit, so it was not undone."])
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

/** Short messages for people and the model: "email: Use a real email…". */
function messages(issues: z.core.$ZodIssue[], prefix: PropertyKey[]) {
  return issues.map((issue) => {
    const path = issue.path.slice(
      prefix.length > 0 && issue.path[0] === prefix[0] ? prefix.length : 0
    )
    return path.length > 0
      ? `${path.join(".")}: ${issue.message}`
      : issue.message
  })
}
