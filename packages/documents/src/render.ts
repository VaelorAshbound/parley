import type { DocumentDefinition, DraftValues, Fields } from "./define.ts"
import type { AnyField } from "./fields.ts"
import { blankText, isRecord, optionPieces } from "./fields/choice.ts"
import type { Clause, Inline, LinkKind, StandardTerms } from "./parse/schema.ts"

// One render model feeds all three outputs: the React preview, the print
// HTML for the PDF, and the DOCX (spec §2 → Document engine). It holds plain
// strings; each output escapes them for its own format.

/** A field's value as shown: its text, or the placeholder while it's empty. */
export type RenderedValue = {
  field: string
  label: string
  text: string | null
  placeholder: string
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
  hint?: string
  lines: RenderedLine[]
  table?: RenderedTable
}

export type RenderedSignature = {
  field: string
  label: string
  /** `value: null` is a line to sign or date by hand. */
  rows: { label: string; value: RenderedValue | null }[]
}

export type RenderedDocument = {
  id: string
  name: string
  coverPage: {
    source: "official" | "parley"
    title: string
    subtitle: string | undefined
    intro: RenderedInline[][]
    sections: RenderedSection[]
    closing: RenderedInline[][]
    signatures: RenderedSignature[]
    footer: RenderedInline[][]
  }
  standardTerms: RenderedStandardTerms
}

export function render<F extends Fields>(
  definition: DocumentDefinition<F>,
  values: DraftValues<F>
): RenderedDocument {
  const fields: Readonly<Record<string, AnyField>> = definition.fields
  const record: object = values
  const valueOf = (key: string): unknown =>
    Object.hasOwn(record, key) ? Reflect.get(record, key) : undefined

  function show(path: string): RenderedValue {
    const [key = "", part] = path.split(".")
    const field = fields[key]
    const partLabel =
      part === undefined
        ? undefined
        : (field?.subfields?.[part] ?? field?.derived?.[part])
    const label = partLabel
      ? `${field?.label}: ${partLabel}`
      : (field?.label ?? path)
    const value = valueOf(key)
    const text =
      value === undefined || !field
        ? null
        : part === undefined
          ? field.format(value)
          : (field.formatPath?.(value, part) ?? null)
    return { field: path, label, text, placeholder: `[${label}]` }
  }

  function inline(nodes: Inline[]): RenderedInline[] {
    return nodes.map((node) => {
      switch (node.type) {
        case "linkedTerm": {
          const paths = definition.linkedTerms[node.term] ?? []
          const values = (Array.isArray(paths) ? paths : [paths]).map(show)
          return { ...node, values }
        }
        case "strong":
        case "definition":
        case "link":
          return { ...node, children: inline(node.children) }
        default:
          return node
      }
    })
  }

  const clause = (node: Clause): RenderedClause => ({
    ...node,
    number: clauseNumber(node.id),
    content: inline(node.content),
    children: node.children.map(clause),
  })

  return {
    id: definition.id,
    name: definition.name,
    coverPage: {
      source: definition.coverPage.source,
      title: definition.coverPage.title,
      subtitle: definition.coverPage.subtitle,
      intro: definition.coverPage.intro.map(inline),
      sections: definition.coverPage.sections.map(
        ({ heading, hint, ...body }): RenderedSection => ({
          heading,
          hint,
          ...("field" in body
            ? fieldBody(
                fields[body.field],
                body.field,
                valueOf(body.field),
                show
              )
            : {
                lines: body.lines.map((line) => ({
                  label: line.label,
                  parts: [{ type: "value", ...show(line.field) }],
                })),
              }),
        })
      ),
      closing: definition.coverPage.closing.map(inline),
      footer: definition.coverPage.footer.map(inline),
      signatures: definition.coverPage.signatures.map((key) =>
        signature(key, fields[key]?.label ?? key, show)
      ),
    },
    standardTerms: {
      title: definition.template.title,
      children: renderBlocks(definition.template, inline, clause),
    },
  }
}

function clauseNumber(id: string) {
  const markers = id.split(".")
  if (markers.length === 1) return `${id}.`
  if (markers.length === 2) return id
  return `${markers.at(-1)}.`
}

function renderBlocks(
  template: StandardTerms,
  inline: (nodes: Inline[]) => RenderedInline[],
  clause: (node: Clause) => RenderedClause
): RenderedStandardTerms["children"] {
  return template.children.map((block) => {
    if (block.type === "section")
      return { ...block, children: block.children.map(clause) }
    if (block.type === "clause") return clause(block)
    return { type: "paragraph", content: inline(block.content) }
  })
}

/**
 * What a field shows on the cover page: a list is a table, a group is a
 * checklist of its parts, a choice or multi-select is one checkbox line per
 * option, and anything else is one line.
 */
function fieldBody(
  field: AnyField | undefined,
  path: string,
  value: unknown,
  show: (path: string) => RenderedValue
): Pick<RenderedSection, "lines" | "table"> {
  if (field?.kind === "list" && field.item)
    return { lines: [], table: listTable(field.item, path, value) }
  if (field?.kind === "group" && field.subfields)
    return {
      lines: Object.entries(field.subfields).map(([part, label]) => {
        const shown = show(`${path}.${part}`)
        return {
          checked: shown.text !== null,
          label,
          parts: [{ type: "value", ...shown }],
        }
      }),
    }
  if ((field?.kind !== "choice" && field?.kind !== "choices") || !field.options)
    return { lines: [{ parts: [{ type: "value", ...show(path) }] }] }
  return { lines: choiceLines(field.options, field.allowOther, path, value) }
}

/** One row per record; an empty list still prints one blank row. */
function listTable(
  item: Readonly<Record<string, AnyField>>,
  path: string,
  value: unknown
): RenderedTable {
  const columns = Object.entries(item)
  const records = Array.isArray(value) ? value.filter(isRecord) : []
  const row = (record: Readonly<Record<string, unknown>>) =>
    columns.map(([key, column]) => ({
      field: path,
      label: column.label,
      text: record[key] === undefined ? null : column.format(record[key]),
      placeholder: `[${column.label}]`,
    }))
  return {
    columns: columns.map(([, column]) => column.label),
    rows: (records.length > 0 ? records : [{}]).map(row),
  }
}

function choiceLines(
  options: NonNullable<AnyField["options"]>,
  allowOther: boolean | undefined,
  path: string,
  value: unknown
): RenderedLine[] {
  const picks = picked(value)
  const other = otherOf(value)
  const lines: RenderedLine[] = Object.entries(options).map(([key, option]) => {
    const pick = picks.find((each) => each.option === key)
    const parts = optionPieces(option).map((piece): Part => {
      if (piece.type === "text") return { type: "text", text: piece.text }
      const { label } = piece.field
      return {
        type: "value",
        field: path,
        label,
        // Only picked options show their values; the others stay blank.
        text: pick ? blankText(option, piece.name, pick.value) : null,
        placeholder: `[${label}]`,
      }
    })
    return { checked: pick !== undefined, parts }
  })
  // Common Paper's pages always print the Other line, filled in or not.
  if (allowOther)
    lines.push({
      checked: other !== null,
      parts: [
        { type: "text", text: "Other: " },
        {
          type: "value",
          field: path,
          label: "Other",
          text: other,
          placeholder: "[Other]",
        },
      ],
    })
  return lines
}

type Picked = { option: string; value?: unknown }

/** The picked options: one for a choice, any number for a multi-select. */
function picked(value: unknown): Picked[] {
  if (isPick(value)) return [value]
  if (isRecord(value) && Array.isArray(value.selected))
    return value.selected.filter(isPick)
  return []
}

/** The Other answer of a choice (`text`) or a multi-select (`other`). */
function otherOf(value: unknown): string | null {
  if (!isRecord(value)) return null
  if (value.option === "other" && typeof value.text === "string")
    return value.text
  return typeof value.other === "string" ? value.other : null
}

function isPick(value: unknown): value is Picked {
  return isRecord(value) && typeof value.option === "string"
}

const SIGNATURE_ROWS = [
  ["Signature", null],
  ["Print Name", "name"],
  ["Title", "title"],
  ["Company", "company"],
  ["Notice Address", "notice"],
  ["Date", null],
] as const

/** The NDA cover page's signature table, one block per party. */
function signature(
  key: string,
  label: string,
  show: (path: string) => RenderedValue
): RenderedSignature {
  return {
    field: key,
    label,
    rows: SIGNATURE_ROWS.map(([rowLabel, part]) => ({
      label: rowLabel,
      value: part === null ? null : show(`${key}.${part}`),
    })),
  }
}
