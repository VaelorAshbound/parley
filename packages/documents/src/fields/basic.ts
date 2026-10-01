import { typed, z } from "../zod.ts"
import {
  hasDecimals,
  plainText,
  scalar,
  type Common,
  unlessMissing,
} from "./core.ts"

// --- Text ---

export function text(config: Common<string>) {
  return scalar("text", config, plainText(200), (value) => value)
}

export function longText(config: Common<string>) {
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

export function date(config: Common<string> & { defaultToday?: boolean }) {
  const field = scalar(
    "date",
    config,
    z.iso.date({ error: unlessMissing("Use a real date, like 2026-09-24.") }),
    formatDate
  )
  return { ...field, defaultToday: config.defaultToday ?? false }
}

// --- Duration ---

export const unit = z.enum([
  "minutes",
  "hours",
  "days",
  "businessDays",
  "calendarDays",
  "weeks",
  "months",
  "quarters",
  "years",
])
export type Unit = z.infer<typeof unit>
/** Each unit in words, for one and for many: "business day(s)". */
export const unitWords = {
  minutes: ["minute", "minutes"],
  hours: ["hour", "hours"],
  days: ["day", "days"],
  businessDays: ["business day", "business days"],
  calendarDays: ["calendar day", "calendar days"],
  weeks: ["week", "weeks"],
  months: ["month", "months"],
  quarters: ["quarter", "quarters"],
  years: ["year", "years"],
} as const satisfies Record<Unit, readonly [string, string]>

const amount = z.int().min(1, "At least 1.").max(999, "At most 999.")
const durationSchema = z.strictObject({ amount, unit })
export type Duration = z.infer<typeof durationSchema>

/** `units` limits the choice where some make no sense (no "5 hours" term). */
export function duration(
  config: Common<Duration> & { units?: readonly [Unit, ...Unit[]] }
) {
  const schema = config.units
    ? z.strictObject({ amount, unit: unit.extract(config.units) })
    : durationSchema
  const field = scalar("duration", config, schema, ({ amount, unit }) => {
    const [one, many] = unitWords[unit]
    return `${amount} ${amount === 1 ? one : many}`
  })
  // The units a form offers, in the order the definition lists them.
  return { ...field, units: config.units ?? unit.options }
}

// --- Money and percent ---

const CURRENCIES = new Set(Intl.supportedValuesOf("currency"))

// One formatter per currency, built on first use: Intl.NumberFormat is
// costly to build, and every money check and print needs one.
const formatters = new Map<string, Intl.NumberFormat>()
function currencyFormat(currency: string) {
  let format = formatters.get(currency)
  if (!format) {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency })
    formatters.set(currency, format)
  }
  return format
}

/** How many decimals a currency uses: USD 2, JPY 0, KWD 3. */
function decimalsOf(currency: string) {
  const fraction = currencyFormat(currency)
    .formatToParts(1)
    .find((part) => part.type === "fraction")
  return fraction?.value.length ?? 0
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

export function money(config: Common<Money>) {
  return scalar("money", config, moneySchema, ({ amount, currency }) =>
    currencyFormat(currency).format(amount)
  )
}

export function percent(config: Common<number> & { decimals?: number }) {
  const decimals = config.decimals ?? 2
  const schema = z
    .number()
    .min(0, "At least 0%.")
    .max(100, "At most 100%.")
    .refine(
      (value) => hasDecimals(value, decimals),
      `Use at most ${decimals} decimals.`
    )
  return scalar("percent", config, schema, (value) => `${value}%`)
}

/** A plain number, like the "2" in "2x the fees". Whole unless `decimals`. */
export function number(
  config: Common<number> & {
    min?: number
    /** "More than 1x the fees": the minimum itself is not allowed. */
    minExclusive?: boolean
    max?: number
    decimals?: number
  }
) {
  const decimals = config.decimals ?? 0
  const min = config.min ?? 0
  const schema = z
    .number()
    .check(
      config.minExclusive
        ? z.gt(min, `More than ${min}.`)
        : z.gte(min, `At least ${min}.`)
    )
    .max(config.max ?? 1e6, `At most ${config.max ?? 1e6}.`)
    .refine(
      (value) => hasDecimals(value, decimals),
      decimals === 0
        ? "Use a whole number."
        : `Use at most ${decimals} decimals.`
    )
  return scalar("number", config, schema, String)
}

/** One pick from a named list, shown as its name (the EU member states). */
export function select<const O extends Record<string, string>>(
  config: Common<keyof O & string> & { options: O }
) {
  const schema = typed<keyof O & string>(
    z.enum(Object.keys(config.options), {
      error: unlessMissing("Pick one of the options."),
    })
  )
  return {
    ...scalar("select", config, schema, (code) => config.options[code] ?? null),
    options: config.options,
  }
}

export function url(config: Common<string>) {
  const message = "Use a full https:// link."
  const schema = z
    .url({
      protocol: /^https$/,
      hostname: z.regexes.domain,
      error: unlessMissing(message),
    })
    .max(500, "Keep the link under 500 characters.")
    // A link printed in a contract: no "https:host" shorthand, no passwords.
    .refine((value) => {
      if (!URL.canParse(value)) return false
      const link = new URL(value)
      return value.startsWith("https://") && !link.username && !link.password
    }, message)
  return scalar("url", config, schema, (value) => value)
}

export const EU_MEMBER_STATES = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GR: "Greece",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
} as const
