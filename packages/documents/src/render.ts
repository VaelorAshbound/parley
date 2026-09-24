import type { DocumentDefinition, DraftValues, Fields } from "./define.ts"
import type { AnyField } from "./fields.ts"
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
    sections: { heading: string; hint?: string; lines: RenderedLine[] }[]
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
    const partLabel = part === undefined ? undefined : field?.subfields?.[part]
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
        ({ heading, hint, ...body }) => ({
          heading,
          hint,
          lines:
            "field" in body
              ? fieldLines(
                  fields[body.field],
                  body.field,
                  valueOf(body.field),
                  show
                )
              : body.lines.map((line) => ({
                  label: line.label,
                  parts: [{ type: "value", ...show(line.field) }],
                })),
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

/** A choice is one checkbox line per option; any other field is one line. */
function fieldLines(
  field: AnyField | undefined,
  path: string,
  value: unknown,
  show: (path: string) => RenderedValue
): RenderedLine[] {
  if (!field?.options) return [{ parts: [{ type: "value", ...show(path) }] }]

  const chosen = isChoice(value) ? value : undefined
  const lines: RenderedLine[] = Object.entries(field.options).map(
    ([key, option]) => {
      const checked = chosen?.option === key
      const nested = option.with
      const [before = "", after] = option.label.split("{value}")
      if (after === undefined || !nested)
        return { checked, parts: [{ type: "text", text: option.label }] }

      const text =
        checked && chosen && "value" in chosen && chosen.value !== undefined
          ? nested.format(chosen.value)
          : null
      const parts: Part[] = [
        { type: "text", text: before },
        {
          type: "value",
          field: path,
          label: nested.label,
          text,
          placeholder: `[${nested.label}]`,
        },
        { type: "text", text: after },
      ]
      return {
        checked,
        parts: parts.filter((part) => part.type !== "text" || part.text),
      }
    }
  )
  if (chosen?.option === "other")
    lines.push({
      checked: true,
      parts: [{ type: "value", ...show(path) }],
    })
  return lines
}

function isChoice(
  value: unknown
): value is { option: string; value?: unknown } {
  return typeof value === "object" && value !== null && "option" in value
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
