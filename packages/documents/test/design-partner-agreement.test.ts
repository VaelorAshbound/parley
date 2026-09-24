import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { designPartnerAgreement as dpa } from "../src/definitions/design-partner-agreement.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const example = dpa.schema.parse(examples["design-partner-agreement"])
const issues = (values: unknown) =>
  dpa.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }))

describe("the Design Partner Agreement", () => {
  it("seeds only the official Effective Date", () => {
    expect(initialValues(dpa, { today: "2026-09-24" })).toEqual({
      effectiveDate: { option: "lastSignature" },
    })
  })

  it("won't let a company sign both sides", () => {
    expect(
      issues({
        provider: { company: "Acme" },
        partner: { company: "acme" },
      })
    ).toEqual([
      {
        path: ["partner"],
        message: "The two parties must be different companies.",
      },
    ])
  })

  it("keeps the Fees in U.S. Dollars, as the official line says", () => {
    const fees = (currency: string) => ({
      fees: { option: "paid", value: { amount: { amount: 500, currency } } },
    })

    expect(issues(fees("EUR"))).toEqual([
      {
        path: ["fees"],
        message: "The Fees line says U.S. Dollars, so use USD.",
      },
    ])
    expect(issues(fees("USD"))).toBeUndefined()
    expect(issues({ fees: { option: "none" } })).toBeUndefined()
  })

  it("needs at least one Partner activity, and an explicit answer for the Provider", () => {
    const { programPartner: _partner, ...noPartner } = example
    const { programProvider: _provider, ...noProvider } = example

    expect(dpa.schema.safeParse(noPartner).success).toBe(false)
    expect(dpa.schema.safeParse(noProvider).success).toBe(false)
    expect(
      dpa.schema.safeParse({
        ...example,
        programProvider: { selected: [{ option: "none" }] },
      }).success
    ).toBe(true)
  })

  it("prints the chosen Program items and Fees with their blanks", () => {
    const checked = (heading: string) =>
      render(dpa, example)
        .coverPage.sections.filter((section) => section.heading === heading)
        .flatMap((section) => section.lines)
        .filter((line) => line.checked)
        .map((line) => line.parts.map((part) => part.text).join(""))

    expect(checked("Program")).toEqual([
      "Participate in 2 Feedback sessions per month",
      "Appear as a customer in private customer lists",
      "Serve as a reference for prospective customers",
      "Other: Share anonymized sales data from two pilot stores",
      "Give a 20% discount to Partner if Partner signs a long-term customer agreement for the Product after completing the Program",
      "Develop the following Product functionality: A weekly reorder report that exports to CSV",
    ])
    expect(checked("Fees")).toEqual([
      "During the Term, Partner will pay Provider $500.00 per month (excluding taxes) in U.S. Dollars to access and use the Product. This amount reflects a discount for Partner’s Feedback and participation in the Program. Partner will pay the fee within 30 days from receipt of invoice.",
    ])
  })
})
