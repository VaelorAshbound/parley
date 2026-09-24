import type { DocumentDefinition, DraftValues, Fields } from "./define.ts"
import type { AnyField } from "./fields.ts"
import { display, hasParts } from "./fields/core.ts"
import type { Clause, Inline, StandardTerms } from "./parse/schema.ts"
import {
  NDA_SIGNATURE_ROWS,
  fieldBody,
  picked,
  signatures,
  templated,
} from "./render/cover.ts"
import type {
  RenderedClause,
  RenderedDocument,
  RenderedInline,
  RenderedSection,
  RenderedStandardTerms,
  RenderedValue,
} from "./render/model.ts"

// Renders a draft into the one model every output reads (spec §2 → Document
// engine). The model's types are in render/model.ts, the cover page layouts
// in render/cover.ts.

export type * from "./render/model.ts"

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
    const value = valueOf(key)
    const shown = (label: string, text: string | null) => ({
      field: path,
      label,
      text,
      placeholder: `[${label}]`,
    })
    if (!field) return shown(path, null)
    if (part === undefined) return shown(field.label, display(field, value))
    if (!hasParts(field)) return shown(field.label, null)
    const partLabel = field.subfields[part] ?? field.derived[part] ?? part
    return shown(
      `${field.label}: ${partLabel}`,
      value === undefined ? null : field.formatPath(value, part)
    )
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
      eyebrow:
        definition.coverPage.source === "parley"
          ? "Cover page by Parley, not by Common Paper"
          : undefined,
      title: definition.coverPage.title,
      subtitle: definition.coverPage.subtitle,
      intro: definition.coverPage.intro.map(inline),
      sections: definition.coverPage.sections.flatMap(
        (section): RenderedSection[] => {
          const { heading, hint, when } = section
          if (
            when &&
            !picked(valueOf(when.field)).some(
              (pick) => pick.option === when.option
            )
          )
            return []
          if ("part" in section)
            return [{ heading, hint, lines: [], part: true }]
          if ("lines" in section) {
            const keys = new Set(section.lines.map((line) => keyOf(line.field)))
            return [
              {
                heading,
                ...(keys.size === 1 && { field: [...keys][0] }),
                hint,
                lines: section.lines.map((line) => ({
                  label: line.label,
                  parts: templated(show(line.field), line.template),
                })),
              },
            ]
          }
          const body = section.template
            ? {
                lines: [
                  { parts: templated(show(section.field), section.template) },
                ],
              }
            : fieldBody(
                fields[section.field],
                section.field,
                valueOf(section.field),
                show
              )
          return [{ heading, field: keyOf(section.field), hint, ...body }]
        }
      ),
      closing: definition.coverPage.closing.map(inline),
      footer: definition.coverPage.footer.map(inline),
      signatures: signatures(
        definition.coverPage.signatures.map((key) => ({
          field: key,
          label: fields[key]?.label ?? key,
        })),
        definition.coverPage.signatureRows ?? NDA_SIGNATURE_ROWS,
        show
      ),
    },
    standardTerms: {
      title: definition.template.title,
      children: renderBlocks(definition.template, inline, clause),
    },
  }
}

/** "party1.email" → "party1". */
function keyOf(path: string) {
  return path.replace(/\..*$/s, "")
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
