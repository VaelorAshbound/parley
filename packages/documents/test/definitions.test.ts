import { describe, expect, it } from "vite-plus/test"

import coverTemplate from "../generated/mutual-nda-coverpage.ts"
import { coverage, initialValues } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"
import type { AnyField } from "../src/fields.ts"
import type { CoverBlock, Inline } from "../src/parse/schema.ts"
import { render, type Part } from "../src/render.ts"
import { examples } from "./examples.ts"

describe.each(Object.entries(definitions))("%s", (id, definition) => {
  const example = definition.schema.parse(examples[id as keyof typeof examples])

  it("is the catalog's document", () => {
    expect(definition.id).toBe(id)
  })

  it("maps every linked term to a field and uses every field", () => {
    expect(coverage(definition)).toEqual({
      unmappedTerms: [],
      unknownTerms: [],
      unusedFields: [],
    })
  })

  it("renders a full example with no placeholder left", () => {
    const rendered = render(definition, example)
    const parts = rendered.coverPage.sections.flatMap((section) =>
      section.lines.flatMap((line) => line.parts)
    )
    const signed = rendered.coverPage.signatures.flatMap((block) =>
      block.rows.flatMap((row) => (row.value ? [row.value] : []))
    )

    expect(missing(parts)).toEqual([])
    expect(signed.filter((value) => value.text === null)).toEqual([])
  })

  it("seeds only valid defaults", () => {
    expect(
      definition.draftSchema.safeParse(
        initialValues(definition, { today: "2026-09-24" })
      ).success
    ).toBe(true)
  })
})

function missing(parts: Part[]) {
  return parts.flatMap((part) =>
    part.type === "value" && part.text === null ? [part.placeholder] : []
  )
}

// --- The Mutual NDA keeps Common Paper's official cover page ---

const nda = definitions["mutual-nda"]
const official = coverTemplate.children

function textOf(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "hint") return node.value
      if (node.type === "linkedTerm") return node.text
      return textOf(node.children)
    })
    .join("")
}

/** "Expires [1 year(s)] from …" → "Expires {value} from …". */
const slot = (value: string) => value.replace(/\[[^\]]*\]/, "{value}")

function blocksUnder(heading: string): CoverBlock[] {
  const start = official.findIndex(
    (block) => block.type === "heading" && block.text === heading
  )
  const end = official.findIndex(
    (block, index) => index > start && block.type === "heading"
  )
  return official.slice(start + 1, end === -1 ? undefined : end)
}

describe("the Mutual NDA's cover page", () => {
  it("uses the official title, subtitle and section headings", () => {
    const headings = official.flatMap((block) =>
      block.type === "heading" ? [block.text] : []
    )

    expect([
      nda.coverPage.title,
      nda.coverPage.subtitle,
      ...nda.coverPage.sections.map((section) => section.heading),
    ]).toEqual(headings)
  })

  it("uses the official hint under each section", () => {
    const hintUnder = (heading: string) => {
      const [first] = blocksUnder(heading)
      return first?.type === "paragraph" && first.content[0]?.type === "hint"
        ? first.content[0].value
        : undefined
    }
    const { sections } = nda.coverPage

    expect(sections.map((section) => [section.heading, section.hint])).toEqual(
      sections.map((section) => [section.heading, hintUnder(section.heading)])
    )
  })

  it("uses the official wording for each choice", () => {
    for (const heading of ["MNDA Term", "Term of Confidentiality"]) {
      const options = blocksUnder(heading).find(
        (block) => block.type === "options"
      )
      const section = nda.coverPage.sections.find(
        (candidate) => candidate.heading === heading
      )
      const fields: Record<string, AnyField> = nda.fields
      const field =
        section && "field" in section ? fields[section.field] : undefined

      expect(
        Object.values(field?.options ?? {}).map((option) => option.label)
      ).toEqual(
        options?.type === "options"
          ? options.items.map((item) => slot(textOf(item.content)))
          : []
      )
    }
  })

  it("labels the governing law and jurisdiction lines as the official page does", () => {
    const section = nda.coverPage.sections.find(
      (candidate) => candidate.heading === "Governing Law & Jurisdiction"
    )
    const labels = blocksUnder("Governing Law & Jurisdiction").map((block) =>
      block.type === "paragraph" ? textOf(block.content).split(":")[0] : ""
    )

    expect(
      section && "lines" in section
        ? section.lines.map((line) => line.label)
        : []
    ).toEqual(labels)
  })

  it("keeps the official intro, closing and attribution", () => {
    const paragraphs = official.filter((block) => block.type === "paragraph")
    const text = (blocks: Inline[][]) => blocks.map(textOf)

    expect(text(nda.coverPage.intro)).toEqual([textOf(paragraphs[0]!.content)])
    expect(text(nda.coverPage.closing)).toEqual([
      "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
    ])
    expect(text(nda.coverPage.footer)).toEqual([
      textOf(paragraphs.at(-1)!.content),
    ])
  })

  it("signs with the official table's rows", () => {
    const table = official.find((block) => block.type === "table")
    const rows =
      table?.type === "table"
        ? table.rows.slice(1).map((row) => textOf(row[0] ?? []))
        : []
    const [first] = render(nda, {}).coverPage.signatures

    expect(first?.rows.map((row) => row.label)).toEqual(
      rows.map((row) => row.replace(/Use either.*$/, "").trim())
    )
  })

  it("won't let a company sign both sides, whatever its case or spacing", () => {
    expect(
      nda.draftSchema.safeParse({
        party1: { company: "Acme" },
        party2: { company: " acme " },
      }).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ["party2"],
        message: "The two parties must be different companies.",
      }),
    ])
    expect(
      nda.draftSchema.safeParse({ party2: { company: "Acme" } }).success
    ).toBe(true)
  })

  it("seeds the official defaults and today's date", () => {
    expect(initialValues(nda, { today: "2026-09-24" })).toEqual({
      purpose:
        "Evaluating whether to enter into a business relationship with the other party.",
      effectiveDate: "2026-09-24",
      mndaTerm: { option: "expires", value: { amount: 1, unit: "years" } },
      confidentialityTerm: {
        option: "fixed",
        value: { amount: 1, unit: "years" },
      },
    })
  })
})
