import { describe, expect, it } from "vite-plus/test"

import { coverage, defineDocument, initialValues } from "../src/define.ts"
import { field } from "../src/fields.ts"
import type { StandardTerms } from "../src/parse/schema.ts"
import { z } from "../src/zod.ts"

// A small template in the parsed shape, so each test reads on its own.
const template: StandardTerms = {
  type: "standardTerms",
  title: "Standard Terms",
  children: [
    {
      type: "clause",
      id: "1",
      content: [
        { type: "text", value: "For the " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Purpose",
          text: "Purpose",
        },
        { type: "text", value: ", under the laws of " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Governing Law",
          text: "Governing Law",
        },
        { type: "text", value: ", notices go to each " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Notice Address",
          text: "Notice Address",
        },
        { type: "text", value: "." },
      ],
      children: [],
    },
  ],
}

const duration = field.duration({ label: "Term length", help: "How long." })

function nda() {
  return defineDocument({
    id: "test-nda",
    version: 1,
    name: "Test NDA",
    template,
    fields: {
      purpose: field.longText({
        label: "Purpose",
        help: "What the information may be used for.",
        default: "Evaluating a business relationship.",
      }),
      effectiveDate: field.date({
        label: "Effective date",
        help: "When it starts.",
        defaultToday: true,
      }),
      term: field.choice({
        label: "MNDA term",
        help: "How long the MNDA lasts.",
        options: {
          fixed: {
            label: "Expires {value} from Effective Date.",
            with: duration,
          },
          untilTerminated: { label: "Continues until terminated." },
        },
        default: { option: "fixed", value: { amount: 1, unit: "years" } },
      }),
      governingLaw: field.jurisdiction({
        label: "Governing law",
        help: "Whose laws apply.",
      }),
      modifications: field.longText({
        label: "Modifications",
        help: "Changes to the standard terms.",
        optional: true,
      }),
      party1: field.party({ label: "Party 1", help: "The first party." }),
      party2: field.party({ label: "Party 2", help: "The second party." }),
    },
    linkedTerms: {
      Purpose: "purpose",
      "Governing Law": "governingLaw.state",
      "Notice Address": ["party1.email", "party2.email"],
    },
    coverPage: {
      source: "parley",
      title: "Test NDA",
      intro: [],
      sections: [
        { heading: "Purpose", field: "purpose" },
        { heading: "Effective Date", field: "effectiveDate" },
        { heading: "MNDA Term", field: "term" },
        {
          heading: "Governing Law & Jurisdiction",
          lines: [
            { label: "Governing Law", field: "governingLaw.state" },
            { label: "Jurisdiction", field: "governingLaw.courtLocation" },
          ],
        },
        { heading: "MNDA Modifications", field: "modifications" },
      ],
      closing: [],
      signatures: ["party1", "party2"],
    },
    rules: (values, issue) => {
      if (
        values.party1?.company !== undefined &&
        values.party1.company === values.party2?.company
      )
        issue("party2", "The two parties must be different companies.")
    },
  })
}

const complete = {
  purpose: "Evaluating a business relationship.",
  effectiveDate: "2026-09-24",
  term: { option: "fixed", value: { amount: 2, unit: "years" } },
  governingLaw: { state: "DE", courtLocation: "New Castle" },
  party1: {
    company: "Acme",
    name: "Ana",
    title: "CEO",
    email: "ana@acme.test",
  },
  party2: { company: "Bolt", name: "Bo", title: "CTO", address: "1 Main St" },
}

describe("defineDocument", () => {
  it("accepts a complete document and leaves optional fields out", () => {
    expect(nda().schema.safeParse(complete).success).toBe(true)
  })

  it("needs every required field once complete", () => {
    const { purpose: _purpose, ...missing } = complete

    expect(nda().schema.safeParse(missing).success).toBe(false)
  })

  it("accepts any part of a draft, and rejects unknown fields", () => {
    const { draftSchema } = nda()

    expect(draftSchema.safeParse({}).success).toBe(true)
    expect(draftSchema.safeParse({ party1: { company: "Acme" } }).success).toBe(
      true
    )
    expect(draftSchema.safeParse({ mystery: 1 }).success).toBe(false)
  })

  it("runs its cross-field rules on drafts and on complete documents", () => {
    const { schema, draftSchema } = nda()
    const same = { party1: { company: "Acme" }, party2: { company: "Acme" } }

    expect(draftSchema.safeParse(same).error?.issues).toEqual([
      expect.objectContaining({
        path: ["party2"],
        message: "The two parties must be different companies.",
      }),
    ])
    expect(
      schema.safeParse({
        ...complete,
        party2: { ...complete.party2, company: "Acme" },
      }).success
    ).toBe(false)
  })

  it("describes a change list for the AI tools, keyed by field", () => {
    const { changesSchema } = nda()

    expect(
      changesSchema.safeParse([
        { key: "purpose", value: "Hiring." },
        { key: "party1", value: { title: null } },
        { key: "modifications", value: null },
      ]).success
    ).toBe(true)
    expect(
      changesSchema.safeParse([{ key: "purpose", value: { title: "x" } }])
        .success
    ).toBe(false)
    expect(
      changesSchema.safeParse([{ key: "mystery", value: 1 }]).success
    ).toBe(false)
    expect(changesSchema.safeParse([]).success).toBe(false)
  })

  it("gives the AI tools every field's label and help", () => {
    const json = JSON.stringify(
      z.toJSONSchema(nda().changesSchema, { io: "input" })
    )

    expect(json).toContain("What the information may be used for.")
    expect(json).toContain("The first party.")
  })
})

describe("initialValues", () => {
  it("seeds the defaults, and today's date where a date asks for it", () => {
    expect(initialValues(nda(), { today: "2026-09-24" })).toEqual({
      purpose: "Evaluating a business relationship.",
      effectiveDate: "2026-09-24",
      term: { option: "fixed", value: { amount: 1, unit: "years" } },
    })
  })

  it("seeds only values the draft schema accepts", () => {
    const definition = nda()

    expect(
      definition.draftSchema.safeParse(
        initialValues(definition, { today: "2026-09-24" })
      ).success
    ).toBe(true)
  })
})

describe("coverage", () => {
  it("finds nothing wrong with a definition that covers its template", () => {
    expect(coverage(nda())).toEqual({
      unmappedTerms: [],
      unknownTerms: [],
      unusedFields: [],
    })
  })

  it("reports terms, links and fields that don't line up", () => {
    const definition = nda()
    const broken = {
      ...definition,
      linkedTerms: {
        Purpose: "purpose",
        "Governing Law": "governingLaw.state",
        "Purposes ": "purpose",
      },
      coverPage: {
        ...definition.coverPage,
        sections: definition.coverPage.sections.filter(
          (section) => section.heading !== "MNDA Modifications"
        ),
      },
    } satisfies typeof definition

    expect(coverage(broken)).toEqual({
      unmappedTerms: ["Notice Address"],
      unknownTerms: ["Purposes "],
      unusedFields: ["modifications"],
    })
  })
})
