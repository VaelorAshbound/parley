import { typed, z } from "../zod.ts"
import {
  checkOption,
  formatChoice,
  isRecord,
  optionSchemas,
  type ChoiceDraft,
  type ChoiceOptions,
  type ChoiceValue,
} from "./choice.ts"
import {
  checkDefault,
  plainText,
  withMeta,
  type Common,
  type Field,
} from "./core.ts"

// Multi-select, for Common Paper's "[ ] pick none, one, or more than one"
// rows: covered claims, training data, payment methods.

type WithOther<Allow> = Allow extends true
  ? { other?: string }
  : Record<never, never>

export type ChoicesValue<O extends ChoiceOptions, Allow> = {
  selected: ChoiceValue<O, false>[]
} & WithOther<Allow>

export type ChoicesDraft<O extends ChoiceOptions, Allow> = {
  selected: ChoiceDraft<O, false>[]
} & WithOther<Allow>

type Config<O extends ChoiceOptions, Allow> = Common<ChoicesDraft<O, Allow>> & {
  options: O
  allowOther?: Allow
  /** Other answers up to 2,000 characters, like a custom covered claim. */
  longOther?: boolean
  /** Options that must be picked alone, like "None". */
  exclusive?: readonly (keyof O & string)[]
  /** Picks needed in a complete document (Other counts). Default 1. */
  min?: number
}

export function choices<
  const O extends ChoiceOptions,
  const Allow extends boolean = false,
>(config: Config<O, Allow>) {
  const fail = (message: string) => {
    throw new Error(`Choices "${config.label}": ${message}`)
  }
  if (Object.hasOwn(config.options, "other"))
    fail('"other" is kept for the Other answer.')
  for (const [key, option] of Object.entries(config.options))
    checkOption(config.label, key, option)
  for (const key of config.exclusive ?? [])
    if (!Object.hasOwn(config.options, key))
      fail(`exclusive option "${key}" is not one of its options.`)

  const order = Object.keys(config.options)
  const min = config.min ?? 1
  const build = (draft: boolean) =>
    z
      .strictObject({
        selected: z
          .array(z.union(optionSchemas(config.options, draft)))
          .max(order.length),
        ...(config.allowOther && {
          other: plainText(config.longOther ? 2000 : 200).exactOptional(),
        }),
      })
      .superRefine((value, ctx) => {
        const issue = (message: string) =>
          ctx.addIssue({ code: "custom", path: ["selected"], message })
        const keys = value.selected.map((item) => item.option)
        const hasOther = "other" in value && value.other !== undefined
        if (new Set(keys).size !== keys.length) issue("Pick each option once.")
        const alone = keys.find((key) => config.exclusive?.includes(key))
        if (alone && (keys.length > 1 || hasOther))
          issue(
            `"${config.options[alone]?.label}" can't be picked with anything else.`
          )
        if (!draft && keys.length + (hasOther ? 1 : 0) < min)
          issue(min === 1 ? "Pick at least one." : `Pick at least ${min}.`)
      })

  const draftSchema = withMeta(
    typed<ChoicesDraft<O, Allow>>(build(true)),
    config
  )
  checkDefault(config, draftSchema)

  return {
    kind: "choices",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: config.default,
    options: config.options,
    allowOther: config.allowOther ?? false,
    schema: withMeta(typed<ChoicesValue<O, Allow>>(build(false)), config),
    draftSchema,
    changeSchema: draftSchema,
    merges: "whole",
    // One stored shape per meaning: picks in the defined order, no empty
    // blanks, no blank Other, and nothing picked means not filled.
    merge(_current, change) {
      if (change === null) return undefined
      const selected = change.selected
        .map((item) =>
          "value" in item &&
          isRecord(item.value) &&
          Object.keys(item.value).length === 0
            ? { option: item.option }
            : item
        )
        .toSorted((a, b) => order.indexOf(a.option) - order.indexOf(b.option))
      const other =
        "other" in change && change.other?.trim() ? change.other : undefined
      if (selected.length === 0 && other === undefined) return undefined
      return other === undefined ? { selected } : { selected, other }
    },
    format(value) {
      const picks = value.selected.map((item) =>
        formatChoice(config.options, item)
      )
      const other = "other" in value ? value.other : undefined
      return [...picks, other].filter(Boolean).join("; ") || null
    },
  } satisfies Field<
    "choices",
    ChoicesValue<O, Allow>,
    ChoicesDraft<O, Allow>
  > & { options: O; allowOther: boolean }
}
