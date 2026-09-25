import type { DocumentDefinition } from "@workspace/documents"

import { documentList } from "../../lib/documents"

import { z } from "../zod"

// The chat's instructions (spec §2 AI design). The stable part comes first:
// the role, the rules and the catalog, then the chosen agreement's fields,
// which stay the same while the agreement does. Only the current values at
// the end change from turn to turn, so the provider can cache the rest.
// T19 adds the full guardrails.

const ROLE = `You are Parley, a drafting assistant. You help the user fill in one of Common Paper's standard agreements, while the live document updates next to the chat.

How to work:
- Talk in short, plain words. The user may not know legal terms.
- Write plain text in short paragraphs: no Markdown headings, lists, tables or links. **Bold** for a key term is fine.
- First understand the deal: who the parties are and what they share, sell or build.
- Pick the agreement with chooseDocument as soon as one clearly fits, and say why in one line. Don't wait for every detail: ask the rest while you fill it in. Ask first only when two agreements fit equally well. Mention related agreements when they usually come together (a CSA often comes with an SLA and a DPA).
- Fill fields with updateFields as soon as you learn a value. Each change carries a short, plain explanation of what it means.
- Never make up names, companies, emails or addresses. Ask for them.
- A jurisdiction's courtLocation is only the city or county ("New Castle County"): the document adds the state itself.
- Ask about a few fields at a time, not all at once.
- If a change is refused, read the reason, fix the value and try again, or ask the user.
- Parley is a demo: it gives no legal advice, and its documents are not for real agreements. Say so if asked.`

const CATALOG = `The agreements (id: name, what it is for):
${documentList
  .map(
    (document) => `- ${document.id}: ${document.name}. ${document.description}`
  )
  .join("\n")}`

/**
 * A field's value shape for the model: the JSON Schema of one change, without
 * what the line already says (title, help) or what adds only tokens (the
 * $schema URL, a date's regex next to format: "date"). A part is never
 * offered null: models tend to fill every key, and a null part clears it.
 */
function shape(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })
  return JSON.stringify(withoutNull(json), function (key, value: unknown) {
    if (key === "$schema" || key === "title" || key === "description") return
    if (key === "pattern" && "format" in this) return
    return value
  })
}

/** The schema with every `{ "type": "null" }` alternative taken out. */
function withoutNull(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutNull)
  if (typeof node !== "object" || node === null) return node
  const copy = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, withoutNull(value)])
  )
  const options = copy.anyOf
  if (!Array.isArray(options)) return copy
  const rest = options.filter(
    (option) =>
      !(
        typeof option === "object" &&
        option !== null &&
        "type" in option &&
        option.type === "null"
      )
  )
  const { anyOf: _anyOf, ...others } = copy
  return rest.length === 1
    ? { ...others, ...rest[0] }
    : { ...others, anyOf: rest }
}

export function instructions({
  definition,
  values,
}: {
  definition: DocumentDefinition | null
  values: Readonly<Record<string, unknown>>
}) {
  if (definition === null)
    return [
      ROLE,
      CATALOG,
      "No agreement is chosen yet. Learn about the deal first, then call chooseDocument with the agreement's id.",
    ].join("\n\n")

  const fields = Object.entries(definition.fields)
  const empty = fields
    .filter(([key, field]) => values[key] === undefined && !field.optional)
    .map(([key]) => key)
  return [
    ROLE,
    CATALOG,
    `The chosen agreement: ${definition.name} (${definition.id}). Its fields (key (kind): label. help. The value updateFields takes, as JSON Schema; the value null clears the whole field). For a field with parts (a party, a jurisdiction), send only the parts that change; the others stay as they are:
${fields
  .map(
    ([key, field]) =>
      `- ${key} (${field.kind}): ${field.label}. ${field.help} Value: ${shape(field.changeSchema)}`
  )
  .join("\n")}`,
    `Current values (JSON): ${JSON.stringify(values)}
Still empty: ${empty.length > 0 ? empty.join(", ") : "nothing required"}.`,
  ].join("\n\n")
}
