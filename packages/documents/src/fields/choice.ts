import { typed, z } from "../zod.ts"
import {
  plainText,
  withMeta,
  type AnyField,
  type Common,
  type Field,
} from "./core.ts"

// --- Choice ---

export type ChoiceOption = { label: string; with?: AnyField }
export type ChoiceOptions = Record<string, ChoiceOption>

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
        : { option: K }
    }[OptionKey<O>]
  | Other<Allow>

export type ChoiceDraft<O extends ChoiceOptions, Allow> =
  | {
      [K in OptionKey<O>]: O[K] extends { with: infer F }
        ? { option: K; value?: DraftOf<F> }
        : { option: K }
    }[OptionKey<O>]
  | Other<Allow>

/** Not generic, so TypeScript can narrow on `option`. */
function formatChoice(
  options: ChoiceOptions,
  choice: { option: string; text: string } | { option: string; value?: unknown }
) {
  if ("text" in choice) return choice.text
  const option = options[choice.option]
  // An old draft can hold an option a later version of the document dropped.
  if (!option) return null
  const nested =
    choice.value !== undefined && option.with
      ? option.with.format(choice.value)
      : null
  return option.label.replace(
    "{value}",
    nested ?? `[${option.with?.label ?? ""}]`
  )
}

export function choice<
  const O extends ChoiceOptions,
  const Allow extends boolean = false,
>(config: Common<ChoiceValue<O, Allow>> & { options: O; allowOther?: Allow }) {
  if (Object.hasOwn(config.options, "other"))
    throw new Error(
      `Choice "${config.label}": "other" is kept for the Other answer.`
    )
  const entries = Object.entries(config.options)
  const otherText = z.strictObject({
    option: z.literal("other"),
    text: plainText(200),
  })
  const union = (draft: boolean) =>
    z.union([
      ...entries.map(([key, option]) =>
        z.strictObject({
          option: z.literal(key),
          ...(option.with && {
            value: draft
              ? option.with.draftSchema.exactOptional()
              : option.with.schema,
          }),
        })
      ),
      ...(config.allowOther ? [otherText] : []),
    ])

  const schema = withMeta(typed<ChoiceValue<O, Allow>>(union(false)), config)
  const draftSchema = withMeta(
    typed<ChoiceDraft<O, Allow>>(union(true)),
    config
  )

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
    merge: (_current, change) => change ?? undefined,
    format: (value) => formatChoice(config.options, value),
  } satisfies Field<"choice", ChoiceValue<O, Allow>, ChoiceDraft<O, Allow>> & {
    options: O
    allowOther: boolean
  }
}
