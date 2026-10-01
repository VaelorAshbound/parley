import { typed, z } from "../zod.ts"
import {
  header,
  display,
  mergeParts,
  withMeta,
  type AnyField,
  type Common,
  type NullableParts,
  type ObjectField,
  type ValueOf,
} from "./core.ts"

// Named answers under one heading, like the DPA's Annex II security
// measures: each part is its own field, and a filled part is a ticked box.

/** Named fields; the self-reference keeps each key known, not indexed. */
type Parts<P> = { readonly [K in keyof P]: AnyField }

/** Optional parts stay optional at runtime; the type keeps every part so. */
export type GroupValue<P extends Parts<P>> = { [K in keyof P]?: ValueOf<P[K]> }

export function group<const P extends Parts<P>>(
  config: Common<never> & {
    parts: P
    /** Parts that must be filled in a complete document. Default 0. */
    min?: number
  }
) {
  const entries: [string, AnyField][] = Object.entries(config.parts)
  const min = config.min ?? 0
  const shape = (pick: (part: AnyField) => z.ZodType) =>
    Object.fromEntries(entries.map(([key, part]) => [key, pick(part)]))
  const filled = (value: Readonly<Record<string, unknown>>) =>
    entries.filter(([key]) => value[key] !== undefined).length

  const draftSchema = withMeta(
    typed<GroupValue<P>>(
      z.strictObject(shape((part) => part.draftSchema)).exactPartial()
    ),
    config
  )
  const schema = typed<GroupValue<P>>(
    z
      .strictObject(
        shape((part) =>
          part.optional ? part.schema.exactOptional() : part.schema
        )
      )
      .refine((value) => filled(value) >= min, {
        message:
          min === 1 ? "Fill in at least one." : `Fill in at least ${min}.`,
      })
  )
  const subfields: { [K in keyof P & string]?: string } = {}
  for (const key in config.parts) subfields[key] = config.parts[key].label

  return {
    ...header("group", config),
    parts: config.parts,
    subfields,
    derived: {},
    schema: withMeta(schema, config),
    draftSchema,
    changeSchema: withMeta(
      typed<NullableParts<GroupValue<P>>>(
        z
          .strictObject(shape((part) => part.changeSchema.nullable()))
          .exactPartial()
      ),
      config
    ),
    merge: mergeParts,
    merges: "parts",
    format(value) {
      const record: Readonly<Record<string, unknown>> = value
      const lines = entries.flatMap(([key, part]) => {
        const text = display(part, record[key])
        return text === null ? [] : [`${part.label}: ${text}`]
      })
      return lines.join("\n") || null
    },
    formatPath: (value, part) => display(config.parts[part], value[part]),
  } satisfies ObjectField<"group", GroupValue<P>, GroupValue<P>> & { parts: P }
}
