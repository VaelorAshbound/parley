import { z } from "../zod.ts"

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
  | "choices"
  | "list"
  | "group"
  | "jurisdiction"
  | "party"
  | "number"
  | "select"
  | "url"

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
  /**
   * Seeded into a new draft (see `initialValues`). Draft-shaped, so a choice
   * can pick an option and leave its blank empty, as Common Paper's pages do.
   */
  readonly default: Draft | undefined
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
  /**
   * "whole": a change replaces the value. "parts": a change is a partial
   * object merged into it, so an undo lists the parts to restore.
   */
  readonly merges: "whole" | "parts"
}

/** A field whose value has named parts, like a party's company and email. */
export interface ObjectField<
  Kind extends FieldKind,
  Value extends Record<string, unknown>,
  Draft extends Partial<Value>,
  /** Parts that are read, never stored, like a party's "notice". */
  Derived extends string = never,
> extends Field<Kind, Value, Draft, NullableParts<Value>> {
  /** The stored parts a form edits, with their names. */
  readonly subfields: { readonly [K in keyof Value & string]?: string }
  /** Parts that are only read, like a party's "notice". */
  readonly derived: { readonly [K in Derived]: string }
  formatPath(
    value: Draft,
    part: (keyof Value & string) | Derived
  ): string | null
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
  readonly merges: "whole" | "parts"
  /** Object kinds: the name of each part, and one part's display text. */
  readonly subfields?: Readonly<Record<string, string>>
  readonly derived?: Readonly<Record<string, string>>
  formatPath?(value: unknown, part: string): string | null
  /** Choice: its options, and whether it takes an Other answer. */
  readonly options?: Readonly<
    Record<
      string,
      {
        label: string
        with?: AnyField
        blanks?: Readonly<Record<string, AnyField>>
      }
    >
  >
  readonly allowOther?: boolean
  /** List: the field behind each column. */
  readonly item?: Readonly<Record<string, AnyField>>
}

export type Common<Value> = {
  label: string
  help: string
  optional?: boolean
  default?: Value
}

export function withMeta<T extends z.ZodType>(
  schema: T,
  config: Common<unknown>
): T {
  return schema.meta({ title: config.label, description: config.help })
}

export function scalar<Kind extends FieldKind, Value>(
  kind: Kind,
  config: Common<Value>,
  schema: z.ZodType<Value>,
  format: (value: Value) => string | null
): Field<Kind, Value> {
  const described = withMeta(schema, config)
  checkDefault(config, described)
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
    merges: "whole",
  }
}

/** A bad default is a bug in a definition: fail when the field is built. */
export function checkDefault(config: Common<unknown>, schema: z.ZodType) {
  if (config.default !== undefined && !schema.safeParse(config.default).success)
    throw new Error(
      `Field "${config.label}": its default is not a valid value.`
    )
}

/** Shallow-merges a partial change; a `null` part removes it. */
export function mergeParts(
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

const MESSAGES = {
  empty: "Fill this in.",
  long: (max: number) =>
    `Keep it under ${max.toLocaleString("en-US")} characters.`,
}

/**
 * Characters a contract must never carry: control characters other than tab
 * and newline (XML can't hold most of them, so Word would call the DOCX
 * corrupt), bidi overrides and isolates (they make the printed text read
 * differently from the stored text), and the non-characters U+FFFE/U+FFFF.
 */
const HIDDEN = /(?![\t\n])\p{Cc}|[\u202A-\u202E\u2066-\u2069\uFFFE\uFFFF]/u

export function plainText(max: number) {
  return z
    .string()
    .overwrite((value) => value.replaceAll(/\r\n?/g, "\n"))
    .trim()
    .min(1, MESSAGES.empty)
    .max(max, MESSAGES.long(max))
    .refine(
      // isWellFormed: no lone surrogate halves.
      (value) => value.isWellFormed() && !HIDDEN.test(value),
      "Remove hidden control characters."
    )
}

/**
 * A schema's own message for a wrong value, while a missing value falls
 * through to the package-wide "Fill this in." (src/zod.ts).
 */
export function unlessMissing(message: string) {
  return (issue: { input?: unknown }) =>
    issue.input === undefined ? undefined : message
}

/** The complete, draft and change value types of a field. */
export type ValueOf<F> = F extends { schema: z.ZodType<infer V> } ? V : never
export type DraftOf<F> = F extends { draftSchema: z.ZodType<infer V> }
  ? V
  : never
export type ChangeOf<F> = F extends { changeSchema: z.ZodType<infer V> }
  ? V
  : never

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** A field's text for a value that may be missing. */
export function display(field: AnyField, value: unknown) {
  return value === undefined ? null : field.format(value)
}

/** True when `value` has no more than `digits` decimals (float-safe). */
export function hasDecimals(value: number, digits: number) {
  // Exact: 1.0000001 is not a whole number, even if it prints close to one.
  return Number(value.toFixed(digits)) === value
}
