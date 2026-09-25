import { describe, expect, test } from "vite-plus/test"

import { scoreFields } from "./score"

describe("scoring an eval's fields", () => {
  test("checks each part of a field on its own", () => {
    const results = scoreFields(
      { party1: { name: "Ana Diaz", email: "ana@acme.test" } },
      { party1: { name: "Ana Diaz, CEO", email: "ana@acme.test" } }
    )

    expect(results).toEqual([
      { path: "party1.name", ok: false, got: "Ana Diaz, CEO" },
      { path: "party1.email", ok: true, got: "ana@acme.test" },
    ])
  })

  test("ignores case, spacing and a final period", () => {
    const [result] = scoreFields({ title: "CEO" }, { title: " ceo. " })

    expect(result?.ok).toBe(true)
  })

  test("takes a court location with or without County", () => {
    const [result] = scoreFields(
      { law: { courtLocation: "New Castle County" } },
      { law: { courtLocation: "New Castle" } }
    )

    expect(result?.ok).toBe(true)
  })

  test("needs numbers and choices to match exactly", () => {
    const results = scoreFields(
      { term: { option: "expires", value: { amount: 2, unit: "years" } } },
      { term: { option: "expires", value: { amount: 1, unit: "years" } } }
    )

    expect(results.map((each) => each.ok)).toEqual([true, false, true])
  })

  test("counts a missing value as wrong", () => {
    const [result] = scoreFields({ party2: { name: "Bo Chen" } }, {})

    expect(result).toEqual({ path: "party2.name", ok: false, got: undefined })
  })
})
