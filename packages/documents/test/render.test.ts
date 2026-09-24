import fc from "fast-check"
import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { defineDocument, type DocumentDefinition } from "../src/define.ts"
import { field } from "../src/fields.ts"
import { readTemplate } from "../src/parse/catalog.ts"
import { parseStandardTerms } from "../src/parse/parse.ts"
import {
  render,
  type RenderedClause,
  type RenderedInline,
} from "../src/render.ts"
import { complete, nda, template } from "./fixtures.ts"

const definition = nda()
const filled = definition.draftSchema.parse(complete)

function textOf(nodes: RenderedInline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "hint") return node.value
      if (node.type === "linkedTerm") return node.text
      return textOf(node.children)
    })
    .join("")
}

function section(values: typeof filled, heading: string) {
  const found = render(definition, values).coverPage.sections.find(
    (candidate) => candidate.heading === heading
  )
  if (!found) throw new Error(`No section ${heading}`)
  return found
}

describe("render: standard terms", () => {
  it("keeps every word of the template", () => {
    const rendered = render(definition, filled)
    const [clause] = rendered.standardTerms.children

    expect(clause?.type === "clause" && textOf(clause.content)).toBe(
      "For the Purpose, under the laws of Governing Law, notices go to each Notice Address."
    )
  })

  it("gives each linked term the value of its field, for the hover", () => {
    const rendered = render(definition, filled)
    const [clause] = rendered.standardTerms.children
    const terms =
      clause?.type === "clause"
        ? clause.content.filter((node) => node.type === "linkedTerm")
        : []

    expect(terms.map((term) => term.values)).toEqual([
      [
        {
          field: "purpose",
          label: "Purpose",
          text: "Evaluating a business relationship.",
          placeholder: "[Purpose]",
        },
      ],
      [
        {
          field: "governingLaw.state",
          label: "Governing law: State",
          text: "Delaware",
          placeholder: "[Governing law: State]",
        },
      ],
      [
        expect.objectContaining({
          field: "party1.email",
          text: "ana@acme.test",
        }),
        expect.objectContaining({ field: "party2.email", text: null }),
      ],
    ])
  })
})

describe("render: real templates", () => {
  it("numbers clauses the way the template does", () => {
    const tree = parseStandardTerms(readTemplate("DPA.md"))
    const rendered = render({ ...definition, template: tree }, filled)
    const numbers = new Map<string, string>()
    const walk = (clauses: RenderedClause[]) => {
      for (const each of clauses) {
        numbers.set(each.id, each.number)
        walk(each.children)
      }
    }
    for (const block of rendered.standardTerms.children)
      if (block.type === "section") walk(block.children)

    expect(numbers.get("1.1")).toBe("1.1")
    expect(numbers.get("3.2.c")).toBe("c.")
    expect(numbers.get("3.2.c.i")).toBe("i.")
  })

  it("numbers top-level clauses with a period", () => {
    const tree = parseStandardTerms(readTemplate("Mutual-NDA.md"))
    const [first] = render({ ...definition, template: tree }, filled)
      .standardTerms.children

    expect(first).toMatchObject({ id: "1", number: "1." })
  })

  it.each(["CSA.md", "Mutual-NDA.md"])(
    "keeps every word of %s, sections, bold text and links included",
    (file) => {
      const tree = parseStandardTerms(readTemplate(file))
      const rendered = render({ ...definition, template: tree }, filled)

      expect(JSON.stringify(stripAdded(rendered.standardTerms))).toBe(
        JSON.stringify({ title: tree.title, children: tree.children })
      )
    }
  )
})

/** The rendered tree minus what render adds: term values, clause numbers. */
function stripAdded(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripAdded)
  if (typeof node !== "object" || node === null) return node
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== "values" && key !== "number")
      .map(([key, value]) => [key, stripAdded(value)])
  )
}

describe("render: cover page", () => {
  it("renders a missing value as its placeholder", () => {
    expect(section({}, "Purpose").lines).toEqual([
      {
        parts: [
          {
            type: "value",
            field: "purpose",
            label: "Purpose",
            text: null,
            placeholder: "[Purpose]",
          },
        ],
      },
    ])
  })

  it("renders a choice as one checkbox line per option", () => {
    const lines = section(filled, "MNDA Term").lines

    expect(lines.map((line) => line.checked)).toEqual([true, false])
    expect(lines[0]?.parts).toEqual([
      { type: "text", text: "Expires " },
      {
        type: "value",
        field: "term",
        label: "Term length",
        text: "2 years",
        placeholder: "[Term length]",
      },
      { type: "text", text: " from Effective Date." },
    ])
    expect(lines[1]?.parts).toEqual([
      { type: "text", text: "Continues until terminated." },
    ])
  })

  it("leaves every option unchecked until one is chosen", () => {
    expect(section({}, "MNDA Term").lines.map((line) => line.checked)).toEqual([
      false,
      false,
    ])
  })

  it("labels each line of a section with several lines", () => {
    const lines = section(filled, "Governing Law & Jurisdiction").lines

    expect(lines.map((line) => [line.label, line.parts[0]])).toEqual([
      ["Governing Law", expect.objectContaining({ text: "Delaware" })],
      [
        "Jurisdiction",
        expect.objectContaining({ text: "courts located in New Castle, DE" }),
      ],
    ])
  })

  it("renders each signature block with blank signing rows", () => {
    const [first] = render(definition, filled).coverPage.signatures

    expect(first).toEqual({
      field: "party1",
      label: "Party 1",
      rows: [
        { label: "Signature", value: null },
        {
          label: "Print Name",
          value: expect.objectContaining({ text: "Ana" }),
        },
        { label: "Title", value: expect.objectContaining({ text: "CEO" }) },
        { label: "Company", value: expect.objectContaining({ text: "Acme" }) },
        {
          label: "Notice Address",
          value: expect.objectContaining({ text: "ana@acme.test" }),
        },
        { label: "Date", value: null },
      ],
    })
  })

  it("shows both notice addresses when a party gives both", () => {
    const [first] = render(definition, {
      party1: { email: "ana@acme.test", address: "1 Main St" },
    }).coverPage.signatures

    expect(first?.rows[4]?.value?.text).toBe("ana@acme.test\n1 Main St")
  })

  it("carries the layout's own words and says who wrote it", () => {
    const rendered = render(definition, {})

    expect(rendered).toMatchObject({
      id: "test-nda",
      name: "Test NDA",
      coverPage: {
        source: "parley",
        title: "Test NDA",
        subtitle: undefined,
        intro: [],
        closing: [],
        footer: [],
      },
    })
  })
})

describe("render: edge cases", () => {
  it("adds a checked line for an Other answer", () => {
    const payment = defineDocument({
      id: "pay",
      version: 1,
      name: "Pay",
      template,
      fields: {
        payment: field.choice({
          label: "Payment",
          help: "How payment works.",
          options: { monthly: { label: "Monthly" } },
          allowOther: true,
        }),
      },
      linkedTerms: {},
      coverPage: {
        source: "parley",
        title: "Pay",
        intro: [],
        sections: [{ heading: "Payment", field: "payment" }],
        closing: [],
        signatures: [],
        footer: [],
      },
    })

    const lines = (
      values: Parameters<typeof render<typeof payment.fields>>[1]
    ) => render(payment, values).coverPage.sections[0]?.lines

    expect(lines({ payment: { option: "other", text: "Quarterly" } })).toEqual([
      { checked: false, parts: [{ type: "text", text: "Monthly" }] },
      {
        checked: true,
        parts: [
          { type: "text", text: "Other: " },
          expect.objectContaining({ type: "value", text: "Quarterly" }),
        ],
      },
    ])
    // Common Paper's pages print the Other line even when nobody used it.
    expect(lines({ payment: { option: "monthly" } })?.at(-1)).toEqual({
      checked: false,
      parts: [
        { type: "text", text: "Other: " },
        expect.objectContaining({ text: null, placeholder: "[Other]" }),
      ],
    })
  })

  it("fills each named blank of the chosen option", () => {
    const cap = defineDocument({
      id: "cap",
      version: 1,
      name: "Cap",
      template,
      fields: {
        cap: field.choice({
          label: "Cap",
          help: "The cap.",
          options: {
            greater: {
              label: "The greater of {amount} or {multiple}x the fees",
              blanks: {
                amount: field.money({ label: "Amount", help: "A floor." }),
                multiple: field.number({ label: "Multiple", help: "Times." }),
              },
            },
          },
        }),
      },
      linkedTerms: {},
      coverPage: {
        source: "parley",
        title: "Cap",
        intro: [],
        sections: [{ heading: "Cap", field: "cap" }],
        closing: [],
        signatures: [],
        footer: [],
      },
    })

    const [line] =
      render(cap, { cap: { option: "greater", value: { multiple: 2 } } })
        .coverPage.sections[0]?.lines ?? []

    const [unfilled] =
      render(cap, { cap: { option: "greater" } }).coverPage.sections[0]
        ?.lines ?? []
    expect(unfilled?.parts.filter((part) => part.type === "value")).toEqual([
      expect.objectContaining({ placeholder: "[Amount]", text: null }),
      expect.objectContaining({ placeholder: "[Multiple]", text: null }),
    ])
    expect(line?.parts).toEqual([
      { type: "text", text: "The greater of " },
      expect.objectContaining({
        label: "Amount",
        text: null,
        placeholder: "[Amount]",
      }),
      { type: "text", text: " or " },
      expect.objectContaining({ label: "Multiple", text: "2" }),
      { type: "text", text: "x the fees" },
    ])
  })

  it("prints a multi-select as one checkbox line per option", () => {
    const claims = defineDocument({
      id: "claims",
      version: 1,
      name: "Claims",
      template,
      fields: {
        claims: field.choices({
          label: "Increased claims",
          help: "Claims with a higher cap.",
          options: {
            confidentiality: { label: "Breach of confidentiality" },
            data: {
              label: "Breach of {value}",
              with: field.text({ label: "Obligations", help: "Which ones." }),
            },
          },
          allowOther: true,
        }),
      },
      linkedTerms: {},
      coverPage: {
        source: "parley",
        title: "Claims",
        intro: [],
        sections: [{ heading: "Increased Claims", field: "claims" }],
        closing: [],
        signatures: [],
        footer: [],
      },
    })

    const lines = render(claims, {
      claims: {
        selected: [{ option: "data", value: "data protection duties" }],
        other: "Misuse of API keys",
      },
    }).coverPage.sections[0]?.lines

    expect(lines).toEqual([
      {
        checked: false,
        parts: [{ type: "text", text: "Breach of confidentiality" }],
      },
      {
        checked: true,
        parts: [
          { type: "text", text: "Breach of " },
          expect.objectContaining({ text: "data protection duties" }),
        ],
      },
      {
        checked: true,
        parts: [
          { type: "text", text: "Other: " },
          expect.objectContaining({ text: "Misuse of API keys" }),
        ],
      },
    ])
  })

  it("shows placeholders, not an error, for a field the document lacks", () => {
    // A definition edited by hand, with no types to catch the mistake.
    const broken = {
      ...definition,
      linkedTerms: { Purpose: "gone" },
      coverPage: {
        ...definition.coverPage,
        sections: [{ heading: "Gone", field: "gone" }],
        signatures: ["ghost"],
      },
    } as unknown as DocumentDefinition

    const rendered = render(broken, {})

    expect(rendered.coverPage.sections[0]?.lines[0]?.parts[0]).toMatchObject({
      text: null,
      placeholder: "[gone]",
    })
    expect(rendered.coverPage.signatures[0]?.label).toBe("ghost")
  })
})

describe("render, for any draft", () => {
  const edits = fc.array(
    fc.record({
      key: fc.constantFrom(...Object.keys(definition.fields)),
      value: fc.oneof(
        fc.constant(null),
        fc.string(),
        fc.constantFrom(
          { option: "fixed" },
          { option: "fixed", value: { amount: 3, unit: "months" } },
          { option: "untilTerminated" },
          { state: "NY" },
          { courtLocation: "Albany" },
          { company: "Acme", email: "a@acme.test" }
        )
      ),
    }),
    { maxLength: 10 }
  )

  it("never throws, and every value is either text or a placeholder", () => {
    fc.assert(
      fc.property(edits, (changes) => {
        const { values } = applyFieldChanges(definition, {}, changes)
        const rendered = render(definition, values)
        const parts = rendered.coverPage.sections.flatMap((each) =>
          each.lines.flatMap((line) => line.parts)
        )

        for (const part of parts)
          expect(
            part.type === "text" || part.text !== null || part.placeholder
          ).toBeTruthy()
      })
    )
  })
})
