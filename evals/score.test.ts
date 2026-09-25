import { describe, expect, test } from "vite-plus/test"

import { mentioned, scoreFields } from "./score"

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

    expect(results.map((each) => each.ok)).toEqual([true, false])
  })

  test("takes the same length in other units as the same duration", () => {
    const results = scoreFields(
      {
        subscriptionPeriod: { amount: 12, unit: "months" },
        pilotPeriod: { amount: 2, unit: "weeks" },
      },
      {
        subscriptionPeriod: { amount: 1, unit: "years" },
        pilotPeriod: { amount: 14, unit: "days" },
      }
    )

    expect(results).toEqual([
      {
        path: "subscriptionPeriod",
        ok: true,
        got: { amount: 1, unit: "years" },
      },
      { path: "pilotPeriod", ok: true, got: { amount: 14, unit: "days" } },
    ])
  })

  test("keeps business days apart from calendar days", () => {
    const [result] = scoreFields(
      { breachNotificationPeriod: { amount: 5, unit: "businessDays" } },
      { breachNotificationPeriod: { amount: 5, unit: "days" } }
    )

    expect(result?.ok).toBe(false)
  })

  test("counts a missing value as wrong", () => {
    const [result] = scoreFields({ party2: { name: "Bo Chen" } }, {})

    expect(result).toEqual({ path: "party2.name", ok: false, got: undefined })
  })

  test("doesn't take an empty court location as a match", () => {
    const [result] = scoreFields(
      { law: { courtLocation: "New Castle County" } },
      { law: { courtLocation: "" } }
    )

    expect(result?.ok).toBe(false)
  })
})

describe("scoring a list inside a field", () => {
  test("takes the same items in any order", () => {
    const results = scoreFields(
      {
        programPartner: {
          selected: [{ option: "feedback" }, { option: "reference" }],
        },
      },
      {
        programPartner: {
          selected: [{ option: "reference" }, { option: "feedback" }],
        },
      }
    )

    expect(results).toEqual([
      {
        path: "programPartner.selected",
        ok: true,
        got: [{ option: "reference" }, { option: "feedback" }],
      },
    ])
  })

  test("compares each item's words like any other value", () => {
    const [result] = scoreFields(
      { fees: { selected: [{ option: "perUnit", value: { unit: "Year" } }] } },
      { fees: { selected: [{ option: "perUnit", value: { unit: "year." } }] } }
    )

    expect(result?.ok).toBe(true)
  })

  test("counts a missing or an extra item as wrong", () => {
    const want = { targets: { selected: [{ option: "uptime" }] } }

    const [missing] = scoreFields(want, { targets: { selected: [] } })
    const [extra] = scoreFields(want, {
      targets: { selected: [{ option: "uptime" }, { option: "response" }] },
    })

    expect(missing?.ok).toBe(false)
    expect(extra?.ok).toBe(false)
  })

  test("counts a list that isn't there as wrong", () => {
    const [result] = scoreFields(
      { trainingData: { selected: [{ option: "none" }] } },
      {}
    )

    expect(result).toEqual({
      path: "trainingData.selected",
      ok: false,
      got: undefined,
    })
  })
})

describe("finding the agreements a reply names", () => {
  test("finds an agreement by its name or its short form", () => {
    expect(
      mentioned(
        "I picked the Cloud Service Agreement. You may also want an SLA and a data processing agreement.",
        ["sla", "dpa", "ai-addendum"]
      )
    ).toEqual(["sla", "dpa"])
  })

  test("doesn't take a short form inside another word", () => {
    expect(
      mentioned("The CSAs of the world, and the DPAX tool.", ["csa", "dpa"])
    ).toEqual([])
  })

  test("finds the NDA by its short form", () => {
    expect(mentioned("Start with a mutual NDA.", ["mutual-nda"])).toEqual([
      "mutual-nda",
    ])
  })
})
