import fc from "fast-check"
import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { defineDocument, type DocumentDefinition } from "../src/define.ts"
import { field } from "../src/fields.ts"
import { readTemplate } from "../src/parse/catalog.ts"
import { parseStandardTerms } from "../src/parse/parse.ts"
import { render, type RenderedInline } from "../src/render.ts"
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
  it.each(["CSA.md", "Mutual-NDA.md"])(
    "keeps every word of %s, sections, bold text and links included",
    (file) => {
      const tree = parseStandardTerms(readTemplate(file))
      const rendered = render({ ...definition, template: tree }, filled)

      expect(JSON.stringify(stripValues(rendered.standardTerms))).toBe(
        JSON.stringify({ title: tree.title, children: tree.children })
      )
    }
  )
})

/** The rendered tree minus the values linked terms gained. */
function stripValues(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripValues)
  if (typeof node !== "object" || node === null) return node
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== "values")
      .map(([key, value]) => [key, stripValues(value)])
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

    const [section] = render(payment, {
      payment: { option: "other", text: "Quarterly" },
    }).coverPage.sections

    expect(section?.lines).toEqual([
      { checked: false, parts: [{ type: "text", text: "Monthly" }] },
      {
        checked: true,
        parts: [expect.objectContaining({ type: "value", text: "Quarterly" })],
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
