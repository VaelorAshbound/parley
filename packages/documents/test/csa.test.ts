import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { initialValues } from "../src/define.ts"
import { csa } from "../src/definitions/csa.ts"
import { examples } from "./examples.ts"

const issues = (values: unknown) =>
  csa.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  })) ?? []

/** The issues a finished page gets: the example with some rows changed. */
const finishedIssues = (changes: object) =>
  csa.schema
    .safeParse({ ...examples.csa, ...changes })
    .error?.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })) ?? []

const perYear = {
  option: "perUnit",
  value: { amount: { amount: 12000, currency: "USD" }, unit: "year" },
} as const

describe("the CSA's cover page rules", () => {
  it("won't let a company sign both sides", () => {
    expect(
      issues({
        provider: { company: "Northwind" },
        customer: { company: " northwind " },
      })
    ).toEqual([
      {
        path: ["customer"],
        message: "The provider and the customer must be different companies.",
      },
    ])
  })

  it("lets fee changes come before the price", () => {
    expect(
      issues({ feeChanges: { selected: [{ option: "taxInclusive" }] } })
    ).toEqual([])
  })

  it("won't take both kinds of fee increase", () => {
    expect(
      issues({
        fees: { selected: [perYear] },
        feeChanges: {
          selected: [
            { option: "mayIncrease", value: 5 },
            { option: "willIncrease", value: 3 },
          ],
        },
      })
    ).toEqual([
      {
        path: ["feeChanges"],
        message: "Pick one kind of fee increase, not both.",
      },
    ])
  })

  it("won't finish a picked option with its details left out", () => {
    const { fields } = csa
    const done = (
      schema: { safeParse: (value: unknown) => { success: boolean } },
      value: unknown
    ) => schema.safeParse(value).success

    expect(done(fields.fees.schema, { selected: [] })).toBe(false)
    expect(
      done(fields.pilot.schema, {
        option: "pilot",
        value: { length: { amount: 1, unit: "months" } },
      })
    ).toBe(false)
    expect(
      done(fields.securityPolicy.schema, {
        selected: [{ option: "certifications" }],
      })
    ).toBe(false)
    expect(done(fields.insurance.schema, { option: "required" })).toBe(false)
  })

  it("won't leave Increased Claims without a cap", () => {
    const message =
      "Increased Claims need a cap. Pick an Increased Cap Amount, or set Increased Claims to None."
    const noCap = { option: "none" } as const

    expect(
      issues({
        increasedClaims: { selected: [{ option: "privacy" }] },
        increasedCapAmount: noCap,
      })
    ).toEqual([{ path: ["increasedCapAmount"], message }])
    expect(
      issues({
        increasedClaims: { selected: [], other: "Breach of Section 2.1" },
        increasedCapAmount: noCap,
      })
    ).toEqual([{ path: ["increasedCapAmount"], message }])
    expect(
      issues({
        increasedClaims: { selected: [{ option: "none" }] },
        increasedCapAmount: noCap,
      })
    ).toEqual([])
  })

  it("won't put one claim under the supercap and under no cap", () => {
    expect(
      issues({
        increasedClaims: {
          selected: [{ option: "privacy" }, { option: "indemnification" }],
        },
        unlimitedClaims: { selected: [{ option: "indemnification" }] },
      })
    ).toEqual([
      {
        path: ["increasedClaims"],
        message:
          "“An Indemnifying Party’s indemnification obligation” can't be both an Increased Claim and an Unlimited Claim.",
      },
    ])
  })

  it("keeps the supercap above the general cap", () => {
    const caps = (general: number, increased: number) =>
      issues({
        generalCapAmount: { option: "multiple", value: general },
        increasedCapAmount: { option: "multiple", value: increased },
      })

    expect(caps(3, 2)).toEqual([
      {
        path: ["increasedCapAmount"],
        message:
          "The Increased Cap Amount must be more than the General Cap Amount.",
      },
    ])
    expect(caps(2, 2)).toHaveLength(1)
    expect(caps(1, 2)).toEqual([])
    expect(
      issues({
        generalCapAmount: { option: "multiple" },
        increasedCapAmount: { option: "multiple", value: 2 },
      })
    ).toEqual([])
  })

  it("lets a draft drop Increased Claims one field at a time", () => {
    const draft = initialValues(csa, { today: "2026-09-24" })
    const { values, rejected } = applyFieldChanges(csa, draft, [
      { key: "increasedClaims", value: { selected: [{ option: "none" }] } },
      { key: "increasedCapAmount", value: { option: "none" } },
    ])

    expect(rejected).toEqual([])
    expect(values.increasedCapAmount).toEqual({ option: "none" })
  })

  it("takes the billing picks as plain values", () => {
    expect(
      issues({
        paymentProcess: {
          option: "invoice",
          value: { frequency: "monthly", days: 30, start: "invoiceDate" },
        },
      })
    ).toEqual([])
    expect(
      issues({
        paymentProcess: {
          option: "automatic",
          value: { frequency: "weekly" },
        },
      })
    ).not.toEqual([])
  })

  it("needs the services named before a finished page bills for them", () => {
    const paymentOnly = {
      professionalServices: {
        selected: [{ option: "payment", value: "Invoiced monthly." }],
      },
    }
    expect(issues(paymentOnly)).toEqual([])
    expect(finishedIssues(paymentOnly)).toEqual([
      {
        path: ["professionalServices"],
        message: "Say which services this payment is for.",
      },
    ])
  })

  it("seeds the options Common Paper pre-marks, and nothing else", () => {
    expect(initialValues(csa, { today: "2026-09-24" })).toEqual({
      orderDate: { option: "lastSignature" },
      renewal: { option: "autoRenew" },
      effectiveDate: { option: "lastSignature" },
      providerCoveredClaims: { option: "standard" },
      customerCoveredClaims: { option: "standard" },
      generalCapAmount: { option: "multiple" },
      increasedClaims: {
        selected: [{ option: "privacy" }, { option: "confidentiality" }],
      },
      increasedCapAmount: { option: "multiple" },
      unlimitedClaims: { selected: [{ option: "indemnification" }] },
      securityPolicy: { selected: [{ option: "reasonableEfforts" }] },
    })
  })
})
