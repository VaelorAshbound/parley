import fc from "fast-check"
import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { nda } from "./fixtures.ts"

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
        issues: ["Use a real date, like 2026-09-24."],
      },
    ])
  })

  it.each(["mystery", "constructor", "toString", "__proto__"])(
    "rejects the unknown field %j without throwing",
    (key) => {
      const result = applyFieldChanges(definition, {}, [{ key, value: "x" }])

      expect(result.values).toEqual({})
      expect(result.rejected).toEqual([
        { key, value: "x", issues: [`There is no field "${key}".`] },
      ])
    }
  )

  it("names the part of an object field that is wrong", () => {
    const { rejected } = applyFieldChanges(definition, {}, [
      { key: "party1", value: { email: "ana at acme" } },
    ])

    expect(rejected[0]?.issues).toEqual(["email: Use a real email address."])
  })

  it("rejects a change that breaks a cross-field rule", () => {
    const { values, rejected } = applyFieldChanges(
      definition,
      { party1: { company: "Acme" } },
      [{ key: "party2", value: { company: "Acme" } }]
    )

    expect(values).toEqual({ party1: { company: "Acme" } })
    expect(rejected[0]?.issues).toEqual([
      "The two parties must be different companies.",
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
        issues: ["This field changed after that edit, so it was not undone."],
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
