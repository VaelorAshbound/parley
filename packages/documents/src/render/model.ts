import type { LinkKind } from "../parse/schema.ts"

// The render model: one shape that the React preview, the print HTML (PDF)
// and the DOCX all read. It holds plain strings; each output escapes them.

/** A field's value as shown: its text, or the placeholder while it's empty. */
export type RenderedValue = {
  field: string
  label: string
  text: string | null
  placeholder: string
  /**
   * The field may stay empty in a complete document. The preview still shows
   * its placeholder (a prompt to fill it); the PDF and DOCX print "None.".
   */
  optional?: true
}

/** What the PDF and DOCX print for an empty optional field (PAR-40). */
export const NONE = "None."

/** An optional field left empty: printed as {@link NONE}, not a placeholder. */
export function isNone({ text, optional }: RenderedValue) {
  return text === null && optional === true
}

/**
 * A line with nothing in it but empty optional values. The PDF and DOCX print
 * a checklist part as its box and label alone, and any other line as "None."
 * (after its label, if it has one), without its template's words ("available
 * at None.") (PAR-40). A line that mixes an empty optional value with a filled
 * one is not a none line: it keeps its words, with "None." inline.
 */
export function isNoneLine({ parts }: RenderedLine) {
  const values = parts.filter((part) => part.type === "value")
  return values.length > 0 && values.every(isNone)
}

export type Part =
  | { type: "text"; text: string }
  | ({ type: "value" } & RenderedValue)

export type RenderedInline =
  | { type: "text"; value: string }
  | { type: "hint"; value: string }
  | { type: "strong"; children: RenderedInline[] }
  | { type: "definition"; term: string; children: RenderedInline[] }
  | { type: "link"; href: string; children: RenderedInline[] }
  | {
      type: "linkedTerm"
      kind: LinkKind
      term: string
      /** The template's words, kept as written (the terms are word for word). */
      text: string
      /** The value(s) behind the term, for the hover in the preview. */
      values: RenderedValue[]
    }

export type RenderedClause = {
  type: "clause"
  id: string
  /** The number as printed: "1.", "1.1", "a.", "i." (the template's markers). */
  number: string
  heading?: string
  content: RenderedInline[]
  children: RenderedClause[]
}

export type RenderedStandardTerms = {
  title: string
  children: (
    | {
        type: "section"
        id: string
        heading: string
        children: RenderedClause[]
      }
    | RenderedClause
    | { type: "paragraph"; content: RenderedInline[] }
  )[]
}

export type RenderedLine = {
  label?: string
  /** Set on the option lines of a choice. */
  checked?: boolean
  parts: Part[]
}

/** A list field's records: one column per item field, one row per record. */
export type RenderedTable = { columns: string[]; rows: RenderedValue[][] }

export type RenderedSection = {
  heading: string
  /**
   * The field the section shows, so the preview can open its editor. Unset
   * for a part heading, or lines from more than one field.
   */
  field?: string
  hint?: string
  lines: RenderedLine[]
  table?: RenderedTable
  /** A heading over the sections below it ("Key Terms"), with no value. */
  part?: true
}

/** The signature table: one column per party, one row per signature row. */
export type RenderedSignatures = {
  parties: { field: string; label: string }[]
  /** A `null` cell is a line to sign or date by hand. */
  rows: { label: string; cells: (RenderedValue | null)[] }[]
}

export type RenderedDocument = {
  id: string
  name: string
  coverPage: {
    source: "official" | "parley"
    /** The label a Parley-written cover page must carry (CC BY 4.0). */
    eyebrow: string | undefined
    title: string
    subtitle: string | undefined
    intro: RenderedInline[][]
    sections: RenderedSection[]
    closing: RenderedInline[][]
    signatures: RenderedSignatures
    footer: RenderedInline[][]
  }
  standardTerms: RenderedStandardTerms
}
