import { typed, z } from "../zod.ts"
import {
  checkDefault,
  withMeta,
  type AnyField,
  type Common,
  type Field,
} from "./core.ts"

// Records of the same shape, printed as a table: the DPA's subprocessors
// (name, country, task), the SLA's uptime-credit tiers. A change replaces the
// whole list; lists are short, and undo still restores the exact old one.

type Columns = Readonly<Record<string, AnyField>>
type ValueOf<F> = F extends { schema: z.ZodType<infer V> } ? V : never
type DraftOf<F> = F extends { draftSchema: z.ZodType<infer D> } ? D : never

export type ListValue<I extends Columns> = { [K in keyof I]: ValueOf<I[K]> }[]
export type ListDraft<I extends Columns> = { [K in keyof I]?: DraftOf<I[K]> }[]

export function list<const I extends Columns>(
  config: Common<ListDraft<I>> & {
    item: I
    /** Records needed in a complete document. Default 1. */
    min?: number
    max?: number
  }
) {
  const entries = Object.entries(config.item)
  const min = config.min ?? 1
  const max = config.max ?? 50
  const record = (draft: boolean) => {
    const shape = Object.fromEntries(
      entries.map(([key, column]) => [
        key,
        draft
          ? column.draftSchema
          : column.optional
            ? column.schema.exactOptional()
            : column.schema,
      ])
    )
    return draft ? z.strictObject(shape).exactPartial() : z.strictObject(shape)
  }
  const rows = (draft: boolean) =>
    z
      .array(record(draft))
      .min(
        draft ? 0 : min,
        min === 1 ? "Add at least one." : `Add at least ${min}.`
      )
      .max(max, `At most ${max}.`)

  const draftSchema = withMeta(typed<ListDraft<I>>(rows(true)), config)
  checkDefault(config, draftSchema)

  const formatItem = (item: Readonly<Record<string, unknown>>) =>
    entries
      .flatMap(([key, column]) =>
        item[key] === undefined ? [] : [column.format(item[key])]
      )
      .join(", ")

  return {
    kind: "list",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: config.default,
    item: config.item,
    columns: Object.fromEntries(
      entries.map(([key, column]) => [key, column.label])
    ),
    schema: withMeta(typed<ListValue<I>>(rows(false)), config),
    draftSchema,
    changeSchema: draftSchema,
    merges: "whole",
    // One stored shape: no empty records, and an empty list is not filled.
    merge(_current, change) {
      if (change === null) return undefined
      const items = change.filter((item) => Object.keys(item).length > 0)
      return items.length === 0 ? undefined : items
    },
    format: (value) => value.map(formatItem).join("\n") || null,
  } satisfies Field<"list", ListValue<I>, ListDraft<I>> & {
    item: I
    columns: Record<string, string>
  }
}
