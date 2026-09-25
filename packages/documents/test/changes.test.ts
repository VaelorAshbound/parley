import fc from "fast-check"
import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges, missingFields } from "../src/changes.ts"
import { initialValues } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"
import { examples } from "./examples.ts"
import { annexDocument, nda } from "./fixtures.ts"

const definition = nda()

describe("applyFieldChanges", () => {
  it("sets a field and records what changed", () => {
    const result = applyFieldChanges(definition, {}, [
      { key: "purpose", value: "Hiring a contractor." },
    ])

    expect(result.values).toEqual({ purpose: "Hiring a contractor." })
    expect(result.applied).toEqual([
      { key: "purpose", before: undefined, after: "Hiring a contractor." },
    ])
    expect(result.rejected).toEqual([])
  })

  it("stores the checked value, trimmed", () => {
    const { values } = applyFieldChanges(definition, {}, [
      { key: "purpose", value: "  Hiring.  " },
    ])

    expect(values.purpose).toBe("Hiring.")
  })

  it("clears a field with null", () => {
    const { values, applied } = applyFieldChanges(
      definition,
      { purpose: "Hiring." },
      [{ key: "purpose", value: null }]
    )

    expect(values).toEqual({})
    expect(applied).toEqual([
      { key: "purpose", before: "Hiring.", after: undefined },
    ])
  })

  it("undoes an edit, but not once the field has changed again", () => {
    const edit = applyFieldChanges(definition, { purpose: "Hiring." }, [
      { key: "purpose", value: "Selling." },
    ])
    expect(edit.inverse).toEqual([
      { key: "purpose", value: "Hiring.", expected: "Selling." },
    ])

    const undo = applyFieldChanges(definition, edit.values, edit.inverse)
    expect(undo.values).toEqual({ purpose: "Hiring." })
    expect(undo.rejected).toEqual([])

    const later = applyFieldChanges(
      definition,
      { purpose: "Leasing." },
      edit.inverse
    )
    expect(later.values).toEqual({ purpose: "Leasing." })
    expect(later.rejected).toEqual([
      {
        key: "purpose",
        value: "Hiring.",
        issues: [
          {
            path: [],
            message:
              "This field changed after that edit, so it was not undone.",
          },
        ],
      },
    ])
  })

  it("won't undo into a field that was cleared since", () => {
    const edit = applyFieldChanges(definition, {}, [
      { key: "purpose", value: "Selling." },
    ])
    const undo = applyFieldChanges(definition, {}, edit.inverse)
    expect(undo.applied).toEqual([])
    expect(undo.rejected).toHaveLength(1)
  })

  it("undoes an object field that was empty, or that was cleared", () => {
    const set = applyFieldChanges(definition, {}, [
      { key: "party1", value: { company: "Acme" } },
    ])
    expect(set.inverse).toEqual([
      { key: "party1", value: null, expected: { company: "Acme" } },
    ])

    const cleared = applyFieldChanges(definition, set.values, [
      { key: "party1", value: null },
    ])
    expect(cleared.inverse).toEqual([
      { key: "party1", value: { company: "Acme" }, expected: null },
    ])
    expect(
      applyFieldChanges(definition, cleared.values, cleared.inverse).values
    ).toEqual(set.values)
  })

  it("merges parts of an object field, and null removes a part", () => {
    const { values } = applyFieldChanges(
      definition,
      { party1: { company: "Acme", name: "Ana" } },
      [{ key: "party1", value: { title: "CEO", name: null } }]
    )

    expect(values.party1).toEqual({ company: "Acme", title: "CEO" })
  })

  it("rejects an invalid value and keeps the valid ones", () => {
    const result = applyFieldChanges(definition, {}, [
      { key: "effectiveDate", value: "2026-02-30" },
      { key: "purpose", value: "Hiring." },
    ])

    expect(result.values).toEqual({ purpose: "Hiring." })
    expect(result.rejected).toEqual([
      {
        key: "effectiveDate",
        value: "2026-02-30",
        issues: [{ path: [], message: "Use a real date, like 2026-09-24." }],
      },
    ])
  })

  it.each(["mystery", "constructor", "toString", "__proto__"])(
    "rejects the unknown field %j without throwing",
    (key) => {
      const result = applyFieldChanges(definition, {}, [{ key, value: "x" }])

      expect(result.values).toEqual({})
      expect(result.rejected).toEqual([
        {
          key,
          value: "x",
          issues: [{ path: [], message: `There is no field "${key}".` }],
        },
      ])
    }
  )

  it("names the part of an object field that is wrong", () => {
    const { rejected } = applyFieldChanges(definition, {}, [
      { key: "party1", value: { email: "ana at acme" } },
    ])

    expect(rejected[0]?.issues).toEqual([
      { path: ["email"], message: "Use a real email address." },
    ])
  })

  it("rejects a change that breaks a cross-field rule", () => {
    const { values, rejected } = applyFieldChanges(
      definition,
      { party1: { company: "Acme" } },
      [{ key: "party2", value: { company: "Acme" } }]
    )

    expect(values).toEqual({ party1: { company: "Acme" } })
    expect(rejected[0]?.issues).toEqual([
      { path: [], message: "The two parties must be different companies." },
    ])
  })

  it("skips a change that changes nothing, so no Undo shows for it", () => {
    const result = applyFieldChanges(definition, { purpose: "Hiring." }, [
      { key: "purpose", value: " Hiring. " },
      { key: "party1", value: { company: null } },
    ])

    expect(result.applied).toEqual([])
    expect(result.inverse).toEqual([])
  })

  it("never changes the values it was given", () => {
    const values = Object.freeze({ party1: Object.freeze({ company: "Acme" }) })

    applyFieldChanges(definition, values, [
      { key: "party1", value: { name: "Ana" } },
    ])

    expect(values).toEqual({ party1: { company: "Acme" } })
  })
})

describe("undo", () => {
  it("restores the values before the changes", () => {
    const before = {
      purpose: "Hiring.",
      party1: { company: "Acme", name: "Ana" },
    }
    const change = applyFieldChanges(definition, before, [
      { key: "purpose", value: "Selling." },
      { key: "party1", value: { title: "CEO", name: null } },
      { key: "effectiveDate", value: "2026-09-24" },
    ])

    const undone = applyFieldChanges(definition, change.values, change.inverse)

    expect(undone.values).toEqual(before)
    expect(undone.rejected).toEqual([])
  })

  it("brings back a US state after a change swapped it for a region", () => {
    const before = {
      governingLaw: { state: "DE", courtLocation: "Dover" },
    } as const
    const change = applyFieldChanges(definition, before, [
      { key: "governingLaw", value: { region: "Ontario, Canada" } },
    ])

    expect(change.values.governingLaw).toEqual({
      region: "Ontario, Canada",
      courtLocation: "Dover",
    })
    expect(
      applyFieldChanges(definition, change.values, change.inverse).values
    ).toEqual(before)
  })

  it("won't overwrite a field someone changed after the AI did", () => {
    const change = applyFieldChanges(definition, {}, [
      { key: "purpose", value: "Selling." },
    ])
    const edited = applyFieldChanges(definition, change.values, [
      { key: "purpose", value: "Buying." },
    ])

    const undone = applyFieldChanges(definition, edited.values, change.inverse)

    expect(undone.values).toEqual({ purpose: "Buying." })
    expect(undone.rejected).toEqual([
      {
        key: "purpose",
        value: null,
        issues: [
          {
            path: [],
            message:
              "This field changed after that edit, so it was not undone.",
          },
        ],
      },
    ])
  })
})

// --- Properties, over random edits to the test NDA ---

const text = fc.string({ maxLength: 30 })
const part = fc.option(fc.constantFrom("Acme", "Bolt", "", "  ", "a@b.test"))
const change = fc.oneof(
  fc.record({ key: fc.constant("purpose"), value: fc.option(text) }),
  fc.record({
    key: fc.constant("effectiveDate"),
    value: fc.option(fc.constantFrom("2026-09-24", "2026-02-30", "soon")),
  }),
  fc.record({
    key: fc.constant("term"),
    value: fc.option(
      fc.constantFrom(
        { option: "untilTerminated" },
        { option: "fixed" },
        { option: "fixed", value: { amount: 2, unit: "years" } },
        { option: "forever" }
      )
    ),
  }),
  ...(["party1", "party2"] as const).map((key) =>
    fc.record({
      key: fc.constant(key),
      value: fc.option(
        fc.record(
          { company: part, name: part, email: part },
          { requiredKeys: [] }
        )
      ),
    })
  ),
  fc.record({ key: fc.constantFrom("mystery", "__proto__"), value: text })
)

describe("applyFieldChanges, for any edits", () => {
  it("keeps the draft valid", () => {
    fc.assert(
      fc.property(fc.array(change, { maxLength: 8 }), (changes) => {
        const { values } = applyFieldChanges(definition, {}, changes)

        expect(definition.draftSchema.safeParse(values).success).toBe(true)
      })
    )
  })

  it("applies or rejects every change, never both and never neither", () => {
    fc.assert(
      fc.property(fc.array(change, { maxLength: 8 }), (changes) => {
        const result = applyFieldChanges(definition, {}, changes)
        const skipped = changes.length - result.rejected.length

        expect(result.applied.length).toBeLessThanOrEqual(skipped)
      })
    )
  })

  it("can always be undone", () => {
    fc.assert(
      fc.property(
        fc.array(change, { maxLength: 6 }),
        fc.array(change, { maxLength: 6 }),
        (setup, edits) => {
          const start = applyFieldChanges(definition, {}, setup).values
          const result = applyFieldChanges(definition, start, edits)
          const undone = applyFieldChanges(
            definition,
            result.values,
            result.inverse
          )

          expect(undone.values).toEqual(start)
          expect(undone.rejected).toEqual([])
        }
      )
    )
  })
})

describe("undo, for lists and groups", () => {
  const annex = annexDocument()
  const text = fc.option(fc.constantFrom("AWS", "EU", "", "AES-256."))
  const edit = fc.oneof(
    fc.record({
      key: fc.constant("subprocessors"),
      value: fc.option(
        fc.array(
          fc.record({ name: text, country: text }, { requiredKeys: [] }),
          {
            maxLength: 3,
          }
        )
      ),
    }),
    fc.record({
      key: fc.constant("measures"),
      value: fc.option(
        fc.record({ encryption: text, access: text }, { requiredKeys: [] })
      ),
    })
  )

  it("restores the values before any edits", () => {
    fc.assert(
      fc.property(
        fc.array(edit, { maxLength: 5 }),
        fc.array(edit, { maxLength: 5 }),
        (setup, edits) => {
          const start = applyFieldChanges(annex, {}, setup).values
          const result = applyFieldChanges(annex, start, edits)
          const undone = applyFieldChanges(annex, result.values, result.inverse)

          expect(undone.values).toEqual(start)
          expect(undone.rejected).toEqual([])
        }
      )
    )
  })
})

describe("missingFields", () => {
  const mutualNda = definitions["mutual-nda"]
  const today = { today: "2026-09-25" }

  it("lists what a complete document still needs, field by field", () => {
    const values = {
      ...initialValues(mutualNda, today),
      party1: { company: "Acme Robotics" },
    }

    expect(missingFields(mutualNda, values)).toEqual([
      { key: "governingLaw", path: [], message: "Fill this in." },
      { key: "party1", path: ["name"], message: "Fill this in." },
      { key: "party1", path: ["title"], message: "Fill this in." },
      { key: "party2", path: [], message: "Fill this in." },
    ])
  })

  it("is empty for a complete document", () => {
    expect(missingFields(mutualNda, examples["mutual-nda"])).toEqual([])
  })
})
