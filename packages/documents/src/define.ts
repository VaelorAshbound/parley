import type { AnyField } from "./fields.ts"
import type { ChangeOf, DraftOf, ValueOf } from "./fields/core.ts"
import type { Inline, StandardTerms } from "./parse/schema.ts"
import { linkedTermsOf } from "./tree.ts"
import { typed, z } from "./zod.ts"

// One definition per document (spec §2 → Document engine): its fields, the
// field each linked term of the standard terms reads, and its cover page.

export type Fields = Record<string, AnyField>
type Key<F> = keyof F & string

type PartsOf<T> = T extends { subfields: infer S; derived: infer D }
  ? (keyof S | keyof D) & string
  : never
/** A field, or a part of an object field: "purpose", "party1.email". */
export type FieldPath<F extends Fields> = {
  [K in Key<F>]: K | `${K}.${PartsOf<F[K]>}`
}[Key<F>]
/**
 * The party fields. Written as `"party" extends Kind` so that the general
 * `Fields` (whose kind is any kind) keeps every key, which lets any
 * definition be used as a `DocumentDefinition`.
 */
type PartyKey<F> = {
  [K in Key<F>]: F[K] extends { kind: infer Kind }
    ? "party" extends Kind
      ? K
      : never
    : never
}[Key<F>]

/** What a draft holds: any subset of the fields, each possibly partial. */
export type DraftValues<F> = { [K in Key<F>]?: DraftOf<F[K]> }
/**
 * A complete document. Keys stay optional in the type because optional
 * fields are chosen at runtime; the schema requires the rest.
 */
export type Values<F> = { [K in Key<F>]?: ValueOf<F[K]> }
/** One edit to one field; `null` clears it. */
export type FieldChange<F> = {
  [K in Key<F>]: { key: K; value: ChangeOf<F[K]> | null }
}[Key<F>]

/** Where a party signs: a stored or derived part, or `null` for a blank line. */
export type SignatureRow = {
  label: string
  part: "company" | "name" | "title" | "email" | "address" | "notice" | null
}

export type CoverSection<F extends Fields> = {
  heading: string
  hint?: string
  /** Show the row only when a choice has this option picked. */
  when?: { field: Key<F>; option: string }
} & (
  | {
      field: FieldPath<F>
      /** Fixed words around the value: "{value} from notice of rejection". */
      template?: string
    }
  | { lines: { label?: string; field: FieldPath<F>; template?: string }[] }
  /** A heading over the sections below it, like "Key Terms". */
  | { part: true }
)

export type CoverPageLayout<F extends Fields> = {
  /** "official": Common Paper's own cover page; "parley": written by us. */
  source: "official" | "parley"
  title: string
  /** A heading under the title, like the NDA's "USING THIS …". */
  subtitle?: string
  intro: Inline[][]
  sections: CoverSection<F>[]
  /** Paragraphs between the sections and the signatures. */
  closing: Inline[][]
  signatures: PartyKey<F>[]
  /** The rows of each signature block. Default: the NDA's rows. */
  signatureRows?: SignatureRow[]
  /** Paragraphs after the signatures: the CC BY 4.0 attribution. */
  footer: Inline[][]
}

type Config<F extends Fields> = {
  id: string
  /** Bumped when a field changes shape; stored drafts carry it (T13). */
  version: number
  name: string
  template: StandardTerms
  fields: F
  /** The field (or fields, like each party's notice address) a term reads. */
  linkedTerms: Record<string, FieldPath<F> | FieldPath<F>[]>
  coverPage: CoverPageLayout<F>
  /**
   * Cross-field rules. They run on drafts ("draft": skip missing values, so a
   * half-filled document isn't blocked) and on complete documents
   * ("complete": may require a field only when another holds some value).
   * Method syntax on purpose: it keeps any definition assignable to
   * `DocumentDefinition`, so the registry can be looped over.
   */
  rules?(
    values: DraftValues<F>,
    issue: (field: Key<F>, message: string) => void,
    phase: "draft" | "complete"
  ): void
}

export type DocumentDefinition<F extends Fields = Fields> = Config<F> & {
  /** A complete document: checked at markComplete and on export. */
  schema: z.ZodType<Values<F>>
  /** A draft: every field optional, object fields partial. */
  draftSchema: z.ZodType<DraftValues<F>>
  /** The input of `updateFields`, for the AI tool and manual edits. */
  changesSchema: z.ZodType<FieldChange<F>[]>
}

export function defineDocument<const F extends Fields>(
  config: Config<F>
): DocumentDefinition<F> {
  checkLayout(config.fields, config.coverPage.sections)
  const entries = Object.entries(config.fields)
  const draftBase = typed<DraftValues<F>>(
    z
      .strictObject(
        Object.fromEntries(
          entries.map(([key, field]) => [key, field.draftSchema])
        )
      )
      .exactPartial()
  )
  const rules =
    (phase: "draft" | "complete") =>
    (values: DraftValues<F>, ctx: z.RefinementCtx) =>
      config.rules?.(
        values,
        (field, message) =>
          ctx.addIssue({ code: "custom", path: [field], message }),
        phase
      )
  const draftSchema = draftBase.superRefine(rules("draft"))

  return {
    ...config,
    schema: typed<Values<F>>(
      z.strictObject(
        Object.fromEntries(
          entries.map(([key, field]) => [
            key,
            field.optional ? field.schema.exactOptional() : field.schema,
          ])
        )
      )
    ).superRefine((values, ctx) =>
      // A complete value is also a valid draft; reading it through the draft
      // schema gives the rules their draft-typed view of it.
      rules("complete")(draftBase.parse(values), ctx)
    ),
    draftSchema,
    changesSchema: typed<FieldChange<F>[]>(
      z
        .array(
          z.union(
            entries.map(([key, field]) =>
              z.strictObject({
                key: z.literal(key),
                value: field.changeSchema.nullable(),
              })
            )
          )
        )
        .min(1, "Send at least one change.")
        .max(50, "Send at most 50 changes at once.")
    ),
  }
}

/** Layout mistakes that types can't catch fail when the document is built. */
function checkLayout(
  fields: Readonly<Record<string, AnyField>>,
  sections: readonly CoverSection<Fields>[]
) {
  for (const section of sections) {
    const fail = (message: string) => {
      throw new Error(`Section "${section.heading}": ${message}`)
    }
    const templated =
      "field" in section
        ? [{ field: section.field, template: section.template }]
        : "lines" in section
          ? section.lines
          : []
    for (const { field, template } of templated) {
      if (template === undefined) continue
      if (template.split("{value}").length !== 2)
        fail("its template needs {value} exactly once.")
      // A part ("party.email") prints on one line; only whole fields can't.
      const kind = fields[field]?.kind
      if (
        kind === "choice" ||
        kind === "choices" ||
        kind === "list" ||
        kind === "group"
      )
        fail("a template only fits a field printed on one line.")
    }
    if (section.when) {
      const choice = fields[section.when.field]
      const isChoice = choice?.kind === "choice" || choice?.kind === "choices"
      if (!isChoice || !Object.hasOwn(choice.options, section.when.option))
        fail("its condition must name a choice and one of its options.")
    }
  }
}

/**
 * A new draft's values: every field's default, and today's date where a date
 * field asks for it. `today` is the user's local date (the caller knows the
 * time zone).
 */
export function initialValues<F extends Fields>(
  definition: DocumentDefinition<F>,
  { today }: { today: string }
): DraftValues<F> {
  const seeded = Object.entries(definition.fields).flatMap(([key, field]) => {
    if ("defaultToday" in field && field.defaultToday === true)
      return [[key, today]]
    return field.default === undefined ? [] : [[key, field.default]]
  })
  return definition.draftSchema.parse(Object.fromEntries(seeded))
}

/**
 * A draft's values moved to another document (the chat may pick a different
 * agreement): each value is kept when the new document has that field and
 * the value still fits it and its rules; every other field starts from the
 * new document's defaults, as in a new draft.
 */
export function switchDocument<F extends Fields>(
  values: Readonly<Record<string, unknown>>,
  definition: DocumentDefinition<F>,
  { today }: { today: string }
): DraftValues<F> {
  let result = initialValues(definition, { today })
  for (const [key, value] of Object.entries(values)) {
    if (!Object.hasOwn(definition.fields, key)) continue
    const next = definition.draftSchema.safeParse({ ...result, [key]: value })
    if (next.success) result = next.data
  }
  return result
}

/**
 * How well a definition covers its template (spec §2: every linked term maps
 * to a field, and every field is used). All three lists must be empty.
 */
export function coverage<F extends Fields>(definition: DocumentDefinition<F>) {
  const terms = [
    ...new Set(linkedTermsOf(definition.template).map((t) => t.term)),
  ]
  const mapped = Object.keys(definition.linkedTerms)
  const paths: string[] = [
    ...Object.values(definition.linkedTerms).flatMap((path): string[] =>
      Array.isArray(path) ? path : [path]
    ),
    ...definition.coverPage.sections.flatMap((section) =>
      "field" in section
        ? [section.field]
        : "lines" in section
          ? section.lines.map((line) => line.field)
          : []
    ),
    ...definition.coverPage.signatures,
  ]
  const used = new Set(paths.map((path) => path.split(".")[0]))

  return {
    unmappedTerms: terms.filter((term) => !mapped.includes(term)),
    unknownTerms: mapped.filter((term) => !terms.includes(term)),
    unusedFields: Object.keys(definition.fields).filter(
      (key) => !used.has(key)
    ),
  }
}
