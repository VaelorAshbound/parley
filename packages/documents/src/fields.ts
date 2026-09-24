import { z } from "./zod.ts"

// The field kinds a document is filled with (spec §2 → Document engine).
// Each field carries three schemas:
// - `schema`: the complete value, checked at markComplete and on export;
// - `draftSchema`: what a draft may hold while it is being filled;
// - `changeSchema`: what one edit may send (for object kinds, a partial
//   object where `null` removes a part).
// Every one carries the label and help in `.meta()`, because a derived schema
// (exactPartial, refine) does not inherit it and the AI tools read it.

export type FieldKind =
  | "text"
  | "longText"
  | "date"
  | "duration"
  | "money"
  | "percent"
  | "choice"
  | "jurisdiction"
  | "party"

export interface Field<
  Kind extends FieldKind = FieldKind,
  Value = unknown,
  Draft = Value,
  Change = Draft,
> {
  readonly kind: Kind
  readonly label: string
  readonly help: string
  /** An optional field may stay empty in a complete document. */
  readonly optional: boolean
  /** Seeded into a new draft (see `initialValues`). */
  readonly default: Value | undefined
  readonly schema: z.ZodType<Value>
  readonly draftSchema: z.ZodType<Draft>
  readonly changeSchema: z.ZodType<Change>
  /**
   * The value after a change, before it is checked. `null` clears the field;
   * `undefined` means "not filled". The caller checks the result with
   * `draftSchema`, so this never has to be trusted.
   */
  merge(current: Draft | undefined, change: Change | null): unknown
  /** Display text, or null when the value can't be shown yet. */
  format(value: Draft): string | null
}

/** A field whose value has named parts, like a party's company and email. */
export interface ObjectField<
  Kind extends FieldKind,
  Value extends Record<string, unknown>,
  Draft extends Partial<Value>,
> extends Field<Kind, Value, Draft, NullableParts<Value>> {
  readonly subfields: { readonly [K in keyof Value & string]: string }
  formatPath(value: Draft, part: keyof Value & string): string | null
}

export type NullableParts<Value> = { [K in keyof Value]?: Value[K] | null }

/**
 * Any field, whatever its value type. The methods use method syntax on
 * purpose: TypeScript checks method parameters bivariantly, so every
 * `Field<…>` fits here and the engine can call them with checked values.
 */
export interface AnyField {
  readonly kind: FieldKind
  readonly label: string
  readonly help: string
  readonly optional: boolean
  readonly default: unknown
  readonly schema: z.ZodType
  readonly draftSchema: z.ZodType
  readonly changeSchema: z.ZodType
  merge(current: unknown, change: unknown): unknown
  format(value: unknown): string | null
}

type Common<Value> = {
  label: string
  help: string
  optional?: boolean
  default?: Value
}

function withMeta<T extends z.ZodType>(schema: T, config: Common<unknown>): T {
  return schema.meta({ title: config.label, description: config.help })
}

function scalar<Kind extends FieldKind, Value>(
  kind: Kind,
  config: Common<Value>,
  schema: z.ZodType<Value>,
  format: (value: Value) => string | null
): Field<Kind, Value> {
  const described = withMeta(schema, config)
  return {
    kind,
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: config.default,
    schema: described,
    draftSchema: described,
    changeSchema: described,
    merge: (_current, change) => change ?? undefined,
    format,
  }
}

/** Shallow-merges a partial change; a `null` part removes it. */
function mergeParts(
  current: Record<string, unknown> | undefined,
  change: Record<string, unknown> | null
) {
  if (change === null) return undefined
  const merged = Object.fromEntries(
    Object.entries({ ...current, ...change }).filter(
      ([, value]) => value !== null && value !== undefined
    )
  )
  return Object.keys(merged).length === 0 ? undefined : merged
}

// --- Text ---

const MESSAGES = {
  empty: "Fill this in.",
  long: (max: number) =>
    `Keep it under ${max.toLocaleString("en-US")} characters.`,
}

function plainText(max: number) {
  return z.string().trim().min(1, MESSAGES.empty).max(max, MESSAGES.long(max))
}

function text(config: Common<string>) {
  return scalar("text", config, plainText(200), (value) => value)
}

function longText(config: Common<string>) {
  return scalar("longText", config, plainText(2000), (value) => value)
}

// --- Date ---

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/**
 * "2026-09-24" → "September 24, 2026". Built by hand, not with `Date` or
 * `Intl`: no time zone can shift the day, and the Worker and the browser
 * print the same words.
 */
function formatDate(value: string) {
  const month = MONTHS[Number(value.slice(5, 7)) - 1]
  return `${month} ${Number(value.slice(8, 10))}, ${value.slice(0, 4)}`
}

function date(config: Common<string> & { defaultToday?: boolean }) {
  const field = scalar(
    "date",
    config,
    z.iso.date("Use a real date, like 2026-09-24."),
    formatDate
  )
  return { ...field, defaultToday: config.defaultToday ?? false }
}

// --- Duration ---

const unit = z.enum([
  "hours",
  "days",
  "businessDays",
  "weeks",
  "months",
  "years",
])
const UNITS = {
  hours: ["hour", "hours"],
  days: ["day", "days"],
  businessDays: ["business day", "business days"],
  weeks: ["week", "weeks"],
  months: ["month", "months"],
  years: ["year", "years"],
} as const satisfies Record<z.infer<typeof unit>, readonly [string, string]>

const durationSchema = z.strictObject({
  amount: z.int().min(1, "At least 1.").max(999, "At most 999."),
  unit,
})
export type Duration = z.infer<typeof durationSchema>

function duration(config: Common<Duration>) {
  return scalar("duration", config, durationSchema, ({ amount, unit }) => {
    const [one, many] = UNITS[unit]
    return `${amount} ${amount === 1 ? one : many}`
  })
}

// --- Money and percent ---

const CURRENCIES = new Set(Intl.supportedValuesOf("currency"))

/** How many decimals a currency uses: USD 2, JPY 0, KWD 3. */
function decimalsOf(currency: string) {
  const fraction = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  })
    .formatToParts(1)
    .find((part) => part.type === "fraction")
  return fraction?.value.length ?? 0
}

/** True when `value` has no more than `digits` decimals (float-safe). */
function hasDecimals(value: number, digits: number) {
  const scaled = value * 10 ** digits
  return Math.abs(scaled - Math.round(scaled)) < 1e-6
}

const moneySchema = z
  .strictObject({
    amount: z.number().min(0, "No negative amounts.").max(1e12, "Too large."),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a currency code, like USD.")
      .refine((code) => CURRENCIES.has(code), "Use a currency code, like USD."),
  })
  .refine(
    ({ amount, currency }) =>
      !CURRENCIES.has(currency) || hasDecimals(amount, decimalsOf(currency)),
    { message: "Too many decimals for this currency.", path: ["amount"] }
  )
export type Money = z.infer<typeof moneySchema>

function money(config: Common<Money>) {
  return scalar("money", config, moneySchema, ({ amount, currency }) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount
    )
  )
}

function percent(config: Common<number>) {
  const schema = z
    .number()
    .min(0, "At least 0%.")
    .max(100, "At most 100%.")
    .refine((value) => hasDecimals(value, 2), "Use at most 2 decimals.")
  return scalar("percent", config, schema, (value) => `${value}%`)
}

// --- Choice ---

type ChoiceOption = { label: string; with?: AnyField }
type ChoiceOptions = Record<string, ChoiceOption>

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

/**
 * The engine's one type assertion. A choice's schema is built at runtime from
 * its options, so TypeScript can't follow its output type. `ChoiceValue` and
 * `ChoiceDraft` describe the same shape; fields.test-d.ts and fields.test.ts
 * check the two agree.
 */
function typed<T>(schema: z.ZodType): z.ZodType<T> {
  return schema as z.ZodType<T>
}

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

function choice<
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

// --- Jurisdiction ---

const stateCode = z.enum(
  [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ],
  "Pick a US state."
)
export type StateCode = z.infer<typeof stateCode>

const STATES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
} as const satisfies Record<StateCode, string>

const jurisdictionParts = {
  state: stateCode,
  // The courts sit in the governing-law state by construction, so the spec's
  // "court must match the governing-law state" rule can't be broken.
  courtLocation: plainText(100),
}

function jurisdiction(
  config: Common<{ state: StateCode; courtLocation: string }>
) {
  const base = z.strictObject(jurisdictionParts)
  type Value = z.infer<typeof base>
  const draftSchema = withMeta(base.exactPartial(), config)
  type Draft = z.infer<typeof draftSchema>
  return {
    kind: "jurisdiction",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: config.default,
    subfields: { state: "State", courtLocation: "Courts" },
    schema: withMeta(base, config),
    draftSchema,
    changeSchema: withMeta(
      z
        .strictObject({
          state: jurisdictionParts.state.nullable(),
          courtLocation: jurisdictionParts.courtLocation.nullable(),
        })
        .exactPartial(),
      config
    ),
    merge: mergeParts,
    format: (value) => (value.state ? STATES[value.state] : null),
    formatPath(value, part) {
      if (!value.state) return null
      if (part === "state") return STATES[value.state]
      return value.courtLocation
        ? `courts located in ${value.courtLocation}, ${value.state}`
        : null
    },
  } satisfies ObjectField<"jurisdiction", Value, Draft>
}

// --- Party ---

const partyParts = {
  company: plainText(200),
  name: plainText(200),
  title: plainText(200),
  email: z.email("Use a real email address.").max(254),
  address: plainText(500),
}

function party(config: Common<never>) {
  const base = z.strictObject({
    company: partyParts.company,
    name: partyParts.name,
    title: partyParts.title,
    email: partyParts.email.exactOptional(),
    address: partyParts.address.exactOptional(),
  })
  type Value = z.infer<typeof base>
  const draftSchema = withMeta(base.exactPartial(), config)
  type Draft = z.infer<typeof draftSchema>
  return {
    kind: "party",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: undefined,
    subfields: {
      company: "Company",
      name: "Name",
      title: "Title",
      email: "Email",
      address: "Address",
    },
    // Notices go to an email or a postal address (the NDA cover page's
    // "Notice Address"), so a complete party needs at least one.
    schema: withMeta(
      base.refine(
        (value) => value.email !== undefined || value.address !== undefined,
        {
          message: "Add an email or a postal address for notices.",
          path: ["email"],
        }
      ),
      config
    ),
    draftSchema,
    changeSchema: withMeta(
      z
        .strictObject({
          company: partyParts.company.nullable(),
          name: partyParts.name.nullable(),
          title: partyParts.title.nullable(),
          email: partyParts.email.nullable(),
          address: partyParts.address.nullable(),
        })
        .exactPartial(),
      config
    ),
    merge: mergeParts,
    format: (value) => value.company ?? null,
    formatPath: (value, part) => value[part] ?? null,
  } satisfies ObjectField<"party", Value, Draft>
}

export const field = {
  text,
  longText,
  date,
  duration,
  money,
  percent,
  choice,
  jurisdiction,
  party,
}
