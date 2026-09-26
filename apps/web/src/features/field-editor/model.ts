import { field as fields, type AnyField } from "@workspace/documents"

// The inline editor's form model (spec §5 Forms). A form holds flat text
// inputs, one per box, named by path: "party1/email",
// "mndaTerm/expires/value/amount". Every kind maps its value to inputs and
// back, recursively, because a choice's blank can be any kind (even another
// choice). The engine stays the judge: `changeOf` builds what `updateFields`
// takes, and `inputFor` puts the engine's errors on the right box.
//
// Names use "/" because TanStack Form reads "." and "[" as nesting.

/** Every input of one form, by name. Checkboxes hold "on" or "". */
export type Inputs = Record<string, string>

const OTHER = "@other"
const PLACE = "@place"
const ROWS = "#"

const join = (prefix: string, part: string | number) => `${prefix}/${part}`

type Option = {
  label: string
  with?: AnyField
  blanks?: Readonly<Record<string, AnyField>>
}

/** The fields behind an option's blanks, by name (`with` is "value"). */
export function blanksOf(option: Option): [string, AnyField][] {
  if (option.with) return [["value", option.with]]
  return Object.entries(option.blanks ?? {})
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const get = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : ""

/** The inputs that show `value` (a draft value, or undefined when empty). */
export function inputsOf(
  field: AnyField,
  value: unknown,
  name: string
): Inputs {
  switch (field.kind) {
    case "text":
    case "longText":
    case "url":
    case "date":
    case "number":
    case "percent":
    case "select":
      return { [name]: text(value) }
    case "duration":
      return {
        [join(name, "amount")]: text(get(value, "amount")),
        // One unit to choose from: it's already chosen.
        [join(name, "unit")]:
          text(get(value, "unit")) ||
          (field.units.length === 1 ? (field.units[0] ?? "") : ""),
      }
    case "money":
      return {
        [join(name, "amount")]: text(get(value, "amount")),
        [join(name, "currency")]: text(get(value, "currency")) || "USD",
      }
    case "choice": {
      const option = text(get(value, "option"))
      const inputs: Inputs = { [name]: option }
      if (field.allowOther)
        inputs[join(join(name, OTHER), "text")] =
          option === "other" ? text(get(value, "text")) : ""
      for (const [key, each] of Object.entries(field.options))
        Object.assign(
          inputs,
          blankInputs(
            each,
            key === option ? get(value, "value") : undefined,
            join(name, key)
          )
        )
      return inputs
    }
    case "choices": {
      const picks = get(value, "selected")
      const selected: unknown[] = Array.isArray(picks) ? picks : []
      const inputs: Inputs = {}
      for (const [key, each] of Object.entries(field.options)) {
        const pick = selected.find((item) => get(item, "option") === key)
        inputs[join(name, key)] = pick ? "on" : ""
        Object.assign(
          inputs,
          blankInputs(each, get(pick, "value"), join(name, key))
        )
      }
      if (field.allowOther) {
        const other = text(get(value, "other"))
        inputs[join(name, OTHER)] = other ? "on" : ""
        inputs[join(join(name, OTHER), "text")] = other
      }
      return inputs
    }
    case "list": {
      const rows = Array.isArray(value) ? value : []
      const inputs: Inputs = {
        [join(name, ROWS)]: String(Math.max(rows.length, 1)),
      }
      // An empty list still shows one row to fill in.
      for (const [index, row] of (rows.length > 0
        ? rows
        : [undefined]
      ).entries())
        for (const [column, cell] of Object.entries(field.item))
          Object.assign(
            inputs,
            inputsOf(cell, get(row, column), join(join(name, index), column))
          )
      return inputs
    }
    case "group":
      return partsInputs(field, value, name, (part) => partField(field, part))
    case "party":
    case "jurisdiction": {
      const inputs = partsInputs(field, value, name, () => undefined)
      if (isWorld(field))
        inputs[join(name, PLACE)] =
          get(value, "region") === undefined ? "us" : "world"
      return inputs
    }
  }
}

function blankInputs(option: Option, value: unknown, prefix: string): Inputs {
  const inputs: Inputs = {}
  for (const [blank, blankField] of blanksOf(option))
    Object.assign(
      inputs,
      inputsOf(
        blankField,
        option.with ? value : get(value, blank),
        join(prefix, blank)
      )
    )
  return inputs
}

type PartsField = Extract<
  AnyField,
  { kind: "group" | "party" | "jurisdiction" }
>

function partsInputs(
  field: PartsField,
  value: unknown,
  name: string,
  fieldOfPart: (part: string) => AnyField | undefined
): Inputs {
  const inputs: Inputs = {}
  for (const part of Object.keys(field.subfields)) {
    const inner = fieldOfPart(part)
    const partValue = get(value, part)
    Object.assign(
      inputs,
      inner
        ? inputsOf(inner, partValue, join(name, part))
        : { [join(name, part)]: text(partValue) }
    )
  }
  return inputs
}

/** A group's part is a field of its own; party and jurisdiction parts are text. */
function partField(field: PartsField, part: string): AnyField | undefined {
  return field.parts?.[part]
}

/** A jurisdiction that takes a province or country as well as a US state. */
export function isWorld(field: AnyField) {
  return field.kind === "jurisdiction" && "region" in field.subfields
}

/** The draft value the inputs hold, or undefined when they hold nothing. */
export function draftOf(
  field: AnyField,
  inputs: Inputs,
  name: string
): unknown {
  const read = (key: string) => inputs[key] ?? ""
  switch (field.kind) {
    case "text":
    case "longText":
    case "url":
    case "date":
    case "select":
      return read(name).trim() === "" ? undefined : read(name)
    case "number":
    case "percent":
      return numberOf(read(name))
    case "duration":
      return compact({
        amount: numberOf(read(join(name, "amount"))),
        unit: read(join(name, "unit")) || undefined,
      })
    case "money": {
      const amount = numberOf(read(join(name, "amount")))
      // A currency alone is the form's default, not an answer.
      if (amount === undefined) return undefined
      return {
        amount,
        currency: read(join(name, "currency")).trim().toUpperCase(),
      }
    }
    case "choice": {
      const option = read(name)
      if (option === "") return undefined
      if (option === "other")
        return { option, text: read(join(join(name, OTHER), "text")) }
      const each = field.options[option]
      const value = each
        ? blankValue(each, inputs, join(name, option))
        : undefined
      return value === undefined ? { option } : { option, value }
    }
    case "choices": {
      const selected = Object.entries(field.options)
        .filter(([key]) => read(join(name, key)) === "on")
        .map(([key, each]) => {
          const value = blankValue(each, inputs, join(name, key))
          return value === undefined ? { option: key } : { option: key, value }
        })
      const other =
        field.allowOther && read(join(name, OTHER)) === "on"
          ? read(join(join(name, OTHER), "text"))
          : undefined
      if (selected.length === 0 && other === undefined) return undefined
      return other === undefined ? { selected } : { selected, other }
    }
    case "list": {
      const rows = Array.from({ length: rowCount(inputs, name) }, (_, index) =>
        compact(
          Object.fromEntries(
            Object.entries(field.item).map(([column, cell]) => [
              column,
              draftOf(cell, inputs, join(join(name, index), column)),
            ])
          )
        )
      ).filter((row) => row !== undefined)
      return rows.length === 0 ? undefined : rows
    }
    case "group":
    case "party":
    case "jurisdiction": {
      const world = isWorld(field)
      const place = read(join(name, PLACE))
      return compact(
        Object.fromEntries(
          Object.keys(field.subfields)
            // Only the kind of place picked counts; the other box may still
            // hold what was typed before switching.
            .filter(
              (part) =>
                !world || part !== (place === "world" ? "state" : "region")
            )
            .map((part) => {
              const inner = partField(field, part)
              return [
                part,
                inner
                  ? draftOf(inner, inputs, join(name, part))
                  : draftOf(TEXT, inputs, join(name, part)),
              ]
            })
        )
      )
    }
  }
}

/** Reads the text parts of a party or jurisdiction. */
const TEXT = fields.text({ label: "Text", help: "A part of the field." })

function blankValue(option: Option, inputs: Inputs, prefix: string) {
  const blanks = blanksOf(option)
  if (option.with) return draftOf(option.with, inputs, join(prefix, "value"))
  return compact(
    Object.fromEntries(
      blanks.map(([blank, blankField]) => [
        blank,
        draftOf(blankField, inputs, join(prefix, blank)),
      ])
    )
  )
}

export function rowCount(inputs: Inputs, name: string) {
  const count = Number(inputs[join(name, ROWS)] ?? "1")
  return Number.isInteger(count) && count > 0 ? count : 1
}

/** A number box: its number, the text itself when it isn't one, or nothing. */
function numberOf(value: string): number | string | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : trimmed
}

/** The object without its undefined entries, or undefined when none are left. */
function compact(record: Record<string, unknown>) {
  const entries = Object.entries(record).filter(
    ([, value]) => value !== undefined
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * What `updateFields` gets for this form: the new value, or `null` to clear
 * the field. Object fields send every part, with `null` for the empty ones,
 * so a part you cleared is removed.
 */
export function changeOf(
  field: AnyField,
  inputs: Inputs,
  name: string
): unknown {
  const draft = draftOf(field, inputs, name)
  if (draft === undefined) return null
  if (
    field.kind !== "party" &&
    field.kind !== "jurisdiction" &&
    field.kind !== "group"
  )
    return draft
  return Object.fromEntries(
    Object.keys(field.subfields).map((part) => [part, get(draft, part) ?? null])
  )
}

/**
 * The input that shows an error the engine found at `path` inside the
 * field. A path it can't place (a rule about the whole field) falls back to
 * the field's own name, where the editor shows it above the inputs.
 */
export function inputFor(
  field: AnyField,
  path: readonly (string | number)[],
  name: string,
  inputs: Inputs
): string {
  const [head, ...rest] = path
  switch (field.kind) {
    case "duration":
      return join(name, head === "unit" ? "unit" : "amount")
    case "money":
      return join(name, head === "currency" ? "currency" : "amount")
    case "choice": {
      if (head === "text") return join(join(name, OTHER), "text")
      const option = inputs[name] ?? ""
      const each = field.options[option]
      if (head !== "value" || !each) return name
      return blankInput(each, rest, join(name, option), inputs)
    }
    case "choices": {
      if (head === "other") return join(join(name, OTHER), "text")
      const [index, part, ...inner] = rest
      const ticked = Object.keys(field.options).filter(
        (key) => inputs[join(name, key)] === "on"
      )
      const option = typeof index === "number" ? ticked[index] : undefined
      const each = option === undefined ? undefined : field.options[option]
      if (
        head !== "selected" ||
        !each ||
        option === undefined ||
        part !== "value"
      )
        return name
      return blankInput(each, inner, join(name, option), inputs)
    }
    case "list": {
      const [column, ...inner] = rest
      const cell = typeof column === "string" ? field.item[column] : undefined
      if (typeof head !== "number" || !cell || typeof column !== "string")
        return name
      return inputFor(cell, inner, join(join(name, head), column), inputs)
    }
    case "group":
    case "party":
    case "jurisdiction": {
      if (typeof head !== "string" || !(head in field.subfields)) return name
      const inner = partField(field, head)
      return inner
        ? inputFor(inner, rest, join(name, head), inputs)
        : join(name, head)
    }
    default:
      return name
  }
}

function blankInput(
  option: Option,
  path: readonly (string | number)[],
  prefix: string,
  inputs: Inputs
) {
  if (option.with)
    return inputFor(option.with, path, join(prefix, "value"), inputs)
  const [blank, ...rest] = path
  const blankField =
    typeof blank === "string" ? option.blanks?.[blank] : undefined
  if (!blankField || typeof blank !== "string")
    return prefix.slice(0, prefix.lastIndexOf("/"))
  return inputFor(blankField, rest, join(prefix, blank), inputs)
}

/**
 * The input updates that remove row `index` of a list: later rows move up
 * one, and the freed last row is emptied, so adding a row starts blank.
 */
export function removeRow(inputs: Inputs, name: string, index: number): Inputs {
  const count = rowCount(inputs, name)
  const updates: Inputs = { [join(name, ROWS)]: String(Math.max(count - 1, 1)) }
  const rowOf = (row: number) => `${join(name, row)}/`
  for (const [key, value] of Object.entries(inputs)) {
    const row = Number(key.slice(name.length + 1).split("/")[0])
    if (!key.startsWith(`${name}/`) || !Number.isInteger(row) || row < index)
      continue
    const rest = key.slice(rowOf(row).length)
    if (row > index) updates[`${rowOf(row - 1)}${rest}`] = value
    if (row === count - 1) updates[key] = ""
  }
  return updates
}

/** The input updates that add an empty row at the end of a list. */
export function addRow(
  field: Extract<AnyField, { kind: "list" }>,
  inputs: Inputs,
  name: string
): Inputs {
  const count = rowCount(inputs, name)
  const row = join(name, count)
  return {
    ...Object.fromEntries(
      Object.entries(field.item).flatMap(([column, cell]) =>
        Object.entries(inputsOf(cell, undefined, join(row, column)))
      )
    ),
    [join(name, ROWS)]: String(count + 1),
  }
}

/** An option's words with its blanks named: "Expires [MNDA length] from…". */
export function optionText(option: Option) {
  const blanks = Object.fromEntries(blanksOf(option))
  return option.label.replaceAll(/\{(\w+)\}/g, (_, blank: string) => {
    const label = blanks[blank]?.label
    return label === undefined ? "…" : `[${label}]`
  })
}
