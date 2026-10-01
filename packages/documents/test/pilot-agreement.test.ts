import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { pilotAgreement as pilot } from "../src/definitions/pilot-agreement.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const example = pilot.schema.parse(examples["pilot-agreement"])
const issues = (values: unknown) =>
  pilot.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }))

describe("the Pilot Agreement", () => {
  it("seeds only the official pre-marked Effective Date", () => {
    expect(initialValues(pilot, { today: "2026-09-24" })).toEqual({
      effectiveDate: { option: "lastSignature" },
    })
  })

  it("won't let a company sign both sides", () => {
    expect(
      issues({
        provider: { company: "Acme" },
        customer: { company: " ACME " },
      })
    ).toEqual([
      {
        path: ["customer"],
        message: "The two parties must be different companies.",
      },
    ])
  })

  it("flags a cap tied to fees on a free pilot, which would be $0", () => {
    const multiple = { option: "multiple", value: 2 }

    expect(issues({ fees: { option: "free" }, generalCap: multiple })).toEqual([
      {
        path: ["generalCap"],
        message:
          "A free pilot has no Fees, so a cap tied to Fees is $0. Pick a dollar amount.",
      },
    ])
    expect(issues({ generalCap: multiple })).toBeUndefined()
    expect(
      issues({
        fees: { option: "free" },
        generalCap: {
          option: "greater",
          value: { amount: { amount: 10_000, currency: "USD" }, multiple: 2 },
        },
      })
    ).toBeUndefined()
  })

  it("asks for a multiple other than 1 in the greater-of cap", () => {
    expect(
      issues({ generalCap: { option: "greater", value: { multiple: 1 } } })
    ).toEqual([
      { path: ["generalCap"], message: "Use a multiple other than 1." },
    ])
  })

  it("requires a General Cap Amount, since an empty one means no cap", () => {
    const { generalCap: _cap, ...rest } = example

    expect(pilot.schema.safeParse(rest).success).toBe(false)
  })

  it("shows the Payment Process only for a paid pilot", () => {
    const headings = (values: typeof example) =>
      render(pilot, values).coverPage.sections.map((section) => section.heading)

    expect(headings(example)).toContain("Payment Process")
    expect(headings({ ...example, fees: { option: "free" } })).not.toContain(
      "Payment Process"
    )
  })

  it("prints the blanks of the chosen options", () => {
    const text = (heading: string) =>
      render(pilot, example)
        .coverPage.sections.find((section) => section.heading === heading)
        ?.lines.filter((line) => line.checked)
        .map((line) => line.parts.map((part) => part.text).join(""))

    expect(text("Payment Process")).toEqual([
      "Pay by invoice: Customer will pay Fees within 30 days from Customer's receipt of invoice.",
    ])
    expect(text("General Cap Amount")).toEqual([
      "The greater of $50,000.00 or 2x the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim",
    ])
  })

  it("needs a Payment Process once a paid pilot is complete", () => {
    const { paymentProcess: _process, ...rest } = example

    expect(issues({ fees: { option: "paid" } })).toBeUndefined()
    expect(
      pilot.schema.safeParse(rest).error?.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      }))
    ).toEqual([
      {
        path: ["paymentProcess"],
        message: "A paid pilot needs a Payment Process.",
      },
    ])
    expect(
      pilot.schema.safeParse({ ...rest, fees: { option: "free" } }).success
    ).toBe(true)
  })

  it("picks the invoice start and the billing cadence from a list", () => {
    const blanks = pilot.fields.paymentProcess.options

    expect(blanks.invoice.blanks.start.kind).toBe("select")
    expect(blanks.automatic.blanks.cadence.kind).toBe("select")
    expect(
      render(pilot, {
        ...example,
        paymentProcess: {
          option: "automatic",
          value: { cadence: "quarterly" },
        },
      })
        .coverPage.sections.find(
          (section) => section.heading === "Payment Process"
        )
        ?.lines.find((line) => line.checked)
        ?.parts.map((part) => part.text)
        .join("")
    ).toContain("for Fees quarterly for immediate payment")
  })
})
