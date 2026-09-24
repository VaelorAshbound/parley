import { describe, expect, it } from "vite-plus/test"

import { coverage, initialValues } from "../src/define.ts"
import { z } from "../src/zod.ts"
import { complete, nda } from "./fixtures.ts"

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
