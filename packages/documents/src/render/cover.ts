import type { SignatureRow } from "../define.ts"
import { blankValue, optionPieces } from "../fields/choice.ts"
import {
  display,
  isRecord,
  type AnyField,
  type ChoiceOptionShape,
} from "../fields/core.ts"
import type {
  Part,
  RenderedLine,
  RenderedSection,
  RenderedSignatures,
  RenderedTable,
  RenderedValue,
} from "./model.ts"

// The cover page's layouts: a field as lines, a checklist or a table; the
// signature grid; a value wrapped in its template's words.

/**
 * What a field shows on the cover page: a list is a table, a group is a
 * checklist of its parts, a choice or multi-select is one checkbox line per
 * option, and anything else is one line.
 */
export function fieldBody(
  field: AnyField | undefined,
  path: string,
  value: unknown,
  show: (path: string) => RenderedValue
): Pick<RenderedSection, "lines" | "table"> {
  switch (field?.kind) {
    case "list":
      return { lines: [], table: listTable(field.item, path, value) }
    case "group":
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
    case "choice":
    case "choices":
      return {
        lines: choiceLines(field.options, field.allowOther, path, value),
      }
    default:
      return { lines: [{ parts: [{ type: "value", ...show(path) }] }] }
  }
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
      text: display(column, record[key]),
      placeholder: `[${column.label}]`,
    }))
  return {
    columns: columns.map(([, column]) => column.label),
    rows: (records.length > 0 ? records : [{}]).map(row),
  }
}

function choiceLines(
  options: Readonly<Record<string, ChoiceOptionShape>>,
  allowOther: boolean,
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
        text: pick
          ? display(piece.field, blankValue(option, piece.name, pick.value))
          : null,
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
export function picked(value: unknown): Picked[] {
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

/** The NDA cover page's signature rows, the default for every document. */
export const NDA_SIGNATURE_ROWS: SignatureRow[] = [
  { label: "Signature", part: null },
  { label: "Print Name", part: "name" },
  { label: "Title", part: "title" },
  { label: "Company", part: "company" },
  { label: "Notice Address", part: "notice" },
  { label: "Date", part: null },
]

/** The signature grid; a row with no part is a line to fill in by hand. */
export function signatures(
  parties: RenderedSignatures["parties"],
  rows: SignatureRow[],
  show: (path: string) => RenderedValue
): RenderedSignatures {
  return {
    parties,
    rows:
      parties.length === 0
        ? []
        : rows.map((row) => ({
            label: row.label,
            cells: parties.map(({ field }) =>
              row.part === null ? null : show(`${field}.${row.part}`)
            ),
          })),
  }
}

/** A value wrapped in its template's fixed words, if it has a template. */
export function templated(
  shown: RenderedValue,
  template: string | undefined
): Part[] {
  const value: Part = { type: "value", ...shown }
  if (template === undefined) return [value]
  const [before = "", after = ""] = template.split("{value}")
  return [
    ...(before ? [{ type: "text" as const, text: before }] : []),
    value,
    ...(after ? [{ type: "text" as const, text: after }] : []),
  ]
}
