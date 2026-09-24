import { typed, z } from "../zod.ts"
import { splitLabel } from "../label.ts"
import {
  checkDefault,
  display,
  plainText,
  withMeta,
  type AnyField,
  type Common,
  type Field,
} from "./core.ts"

// --- Choice ---

/**
 * One option. Its label may hold blanks: `{value}` filled by `with`, or named
 * blanks (`{amount}`, `{multiple}`) filled by the fields in `blanks`.
 */
export type ChoiceOption = {
  label: string
  with?: AnyField
  blanks?: Readonly<Record<string, AnyField>>
}
export type ChoiceOptions = Record<string, ChoiceOption>

/** The fields that fill an option's blanks, by the name its label uses. */
export function blanksOf(
  option: ChoiceOption
): Readonly<Record<string, AnyField>> {
  return option.blanks ?? (option.with ? { value: option.with } : {})
}

type ValueOf<F> = F extends { schema: z.ZodType<infer V> } ? V : never
type DraftOf<F> = F extends { draftSchema: z.ZodType<infer D> } ? D : never

type Other<Allow> = Allow extends true
  ? { option: "other"; text: string }
  : never
/** Option keys; "other" is kept for the Other answer (checked at runtime). */
type OptionKey<O> = Exclude<keyof O & string, "other">

export type ChoiceValue<O extends ChoiceOptions, Allow> =
  | {
      [K in OptionKey<O>]: O[K] extends { with: infer F }
        ? { option: K; value: ValueOf<F> }
        : O[K] extends { blanks: infer B }
          ? { option: K; value: { [N in keyof B]: ValueOf<B[N]> } }
          : { option: K }
    }[OptionKey<O>]
  | Other<Allow>

export type ChoiceDraft<O extends ChoiceOptions, Allow> =
  | {
      [K in OptionKey<O>]: O[K] extends { with: infer F }
        ? { option: K; value?: DraftOf<F> }
        : O[K] extends { blanks: infer B }
          ? { option: K; value?: { [N in keyof B]?: DraftOf<B[N]> } }
          : { option: K }
    }[OptionKey<O>]
  | Other<Allow>

/** Every blank in the label has a field, and every field has one blank. */
export function checkOption(choice: string, key: string, option: ChoiceOption) {
  const fail = (message: string) => {
    throw new Error(`Choice "${choice}", option "${key}": ${message}.`)
  }
  if (option.with && option.blanks) fail("use with or blanks, not both")
  const names = splitLabel(option.label).flatMap((piece) =>
    piece.type === "blank" ? [piece.name] : []
  )
  const fields = blanksOf(option)
  for (const [index, name] of names.entries()) {
    if (names.indexOf(name) !== index)
      fail(`blank {${name}} appears twice in its label`)
    if (!Object.hasOwn(fields, name))
      fail(`blank {${name}} in its label has no field`)
  }
  for (const name of Object.keys(fields))
    if (!names.includes(name)) fail(`blank {${name}} is missing from its label`)
}

/** The schema of an option's blanks: complete, or while drafting. */
function blankSchema(option: ChoiceOption, draft: boolean) {
  if (option.with)
    return draft ? option.with.draftSchema.exactOptional() : option.with.schema
  if (!option.blanks) return undefined
  const entries = Object.entries(option.blanks)
  if (!draft)
    return z.strictObject(
      Object.fromEntries(entries.map(([name, blank]) => [name, blank.schema]))
    )
  return z
    .strictObject(
      Object.fromEntries(
        entries.map(([name, blank]) => [name, blank.draftSchema])
      )
    )
    .exactPartial()
    .exactOptional()
}

/**
 * An option's label as text and blanks, each blank with the field that fills
 * it (checkOption guarantees every blank has one).
 */
export type OptionPiece =
  | { type: "text"; text: string }
  | { type: "blank"; name: string; field: AnyField }

export function optionPieces(option: ChoiceOption) {
  const blanks = Object.entries(blanksOf(option))
  return splitLabel(option.label).flatMap((piece): OptionPiece[] =>
    piece.type === "text"
      ? [piece]
      : blanks
          .filter(([name]) => name === piece.name)
          .map(([name, field]) => ({ type: "blank", name, field }))
  )
}

/** The text of one blank: its value, or the blank field's placeholder. */
/** The value of one blank: the whole value for `with`, a part for `blanks`. */
export function blankValue(option: ChoiceOption, name: string, value: unknown) {
  return option.with ? value : isRecord(value) ? value[name] : undefined
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Not generic, so TypeScript can narrow on `option`. */
export function formatChoice(
  options: ChoiceOptions,
  choice: { option: string; text: string } | { option: string; value?: unknown }
) {
  if ("text" in choice) return choice.text
  const option = options[choice.option]
  // An old draft can hold an option a later version of the document dropped.
  if (!option) return null
  const value = "value" in choice ? choice.value : undefined
  return optionPieces(option)
    .map((piece) =>
      piece.type === "text"
        ? piece.text
        : (display(piece.field, blankValue(option, piece.name, value)) ??
          `[${piece.field.label}]`)
    )
    .join("")
}

/** One stored shape per meaning: an option with no blanks filled has none. */
export function tidy(value: unknown) {
  if (!isRecord(value) || !("value" in value)) return value
  const empty =
    value.value === undefined ||
    (isRecord(value.value) && Object.keys(value.value).length === 0)
  if (!empty) return value
  const { value: _empty, ...rest } = value
  return rest
}

/** One `{ option, value? }` schema per option. */
export function optionSchemas(options: ChoiceOptions, draft: boolean) {
  return Object.entries(options).map(([key, option]) => {
    const value = blankSchema(option, draft)
    return z.strictObject({ option: z.literal(key), ...(value && { value }) })
  })
}

export function choice<
  const O extends ChoiceOptions,
  const Allow extends boolean = false,
>(config: Common<ChoiceDraft<O, Allow>> & { options: O; allowOther?: Allow }) {
  if (Object.hasOwn(config.options, "other"))
    throw new Error(
      `Choice "${config.label}": "other" is kept for the Other answer.`
    )
  const entries = Object.entries(config.options)
  for (const [key, option] of entries) checkOption(config.label, key, option)
  const otherText = z.strictObject({
    option: z.literal("other"),
    text: plainText(200),
  })
  const union = (draft: boolean) =>
    z.union([
      ...optionSchemas(config.options, draft),
      ...(config.allowOther ? [otherText] : []),
    ])

  const schema = withMeta(typed<ChoiceValue<O, Allow>>(union(false)), config)
  const draftSchema = withMeta(
    typed<ChoiceDraft<O, Allow>>(union(true)),
    config
  )
  checkDefault(config, draftSchema)

  return {
    kind: "choice",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: config.default,
    options: config.options,
    allowOther: config.allowOther ?? false,
    schema,
    draftSchema,
    changeSchema: draftSchema,
    merge: (_current, change) => (change === null ? undefined : tidy(change)),
    merges: "whole",
    format: (value) => formatChoice(config.options, value),
  } satisfies Field<"choice", ChoiceValue<O, Allow>, ChoiceDraft<O, Allow>> & {
    options: O
    allowOther: boolean
  }
}
