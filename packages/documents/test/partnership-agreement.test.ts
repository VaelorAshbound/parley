import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { partnershipAgreement as partnership } from "../src/definitions/partnership-agreement.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const example = partnership.schema.parse(examples["partnership-agreement"])
const issues = (values: unknown) =>
  partnership.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }))

/** The issues a complete Agreement gets once `change` is applied. */
const completeIssues = (change: object) =>
  partnership.schema
    .safeParse({ ...example, ...change })
    .error?.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))

const none = { selected: [{ option: "none" }] }
const promotes = {
  selected: [{ option: "promoActivities", value: "A joint webinar" }],
}
const pays = { selected: [{ option: "payment", value: "$1,000" }] }

describe("the Partnership Agreement", () => {
  it("seeds the official pre-marked options", () => {
    expect(initialValues(partnership, { today: "2026-09-24" })).toEqual({
      territory: { option: "worldwide" },
      endDate: { option: "afterEffective" },
      effectiveDate: { option: "lastSignature" },
    })
  })

  it("won't let a company sign both sides", () => {
    expect(
      issues({ company: { company: "Acme" }, partner: { company: "ACME" } })
    ).toEqual([
      {
        path: ["partner"],
        message: "The two parties must be different companies.",
      },
    ])
  })

  it("needs at least one Obligation across both parties", () => {
    const both = { companyObligations: none, partnerObligations: none }

    expect(issues(both)).toBeUndefined()
    expect(completeIssues(both)).toEqual([
      {
        path: ["partnerObligations"],
        message: "Pick at least one Obligation for either party.",
      },
    ])
    expect(
      completeIssues({ companyObligations: none, partnerObligations: promotes })
    ).toBeUndefined()
  })

  it("needs a Payment Schedule when an Obligation is a payment", () => {
    const change = {
      companyObligations: pays,
      paymentSchedule: { option: "none" },
    }

    expect(issues(change)).toBeUndefined()
    expect(completeIssues(change)).toEqual([
      {
        path: ["paymentSchedule"],
        message: "An Obligation is a payment, so fill in the Payment Schedule.",
      },
    ])
    expect(
      completeIssues({ ...change, companyObligations: promotes })
    ).toBeUndefined()
  })

  it("flags caps tied to fees when no Obligation is a payment", () => {
    const message =
      "No Obligation is a payment, so a cap tied to fees is $0. Pick a dollar amount."
    const change = {
      companyObligations: promotes,
      partnerObligations: none,
      generalCap: { option: "multiple", value: 2 },
      increasedCap: { option: "multiple", value: 2 },
    }

    expect(issues(change)).toBeUndefined()
    expect(completeIssues(change)).toEqual([
      { path: ["generalCap"], message },
      { path: ["increasedCap"], message },
    ])
    expect(
      completeIssues({ ...change, partnerObligations: pays })
    ).toBeUndefined()
  })

  it("asks for an Increased Cap multiple other than 1", () => {
    expect(issues({ increasedCap: { option: "multiple", value: 1 } })).toEqual([
      { path: ["increasedCap"], message: "Use a number other than 1." },
    ])
  })

  it("keeps Increased Claims and the Increased Cap Amount in step", () => {
    const cap = { option: "fixed", value: { amount: 1000, currency: "USD" } }
    const noCap = { option: "none" }

    // A draft can change the two one at a time.
    expect(issues({ increasedClaims: none, increasedCap: cap })).toBeUndefined()
    expect(
      completeIssues({ increasedClaims: none, increasedCap: cap })
    ).toEqual([
      {
        path: ["increasedCap"],
        message: "There are no Increased Claims, so pick None.",
      },
    ])
    expect(
      completeIssues({
        increasedClaims: { selected: [], other: "Data breaches" },
        increasedCap: noCap,
      })
    ).toEqual([
      {
        path: ["increasedCap"],
        message: "Pick a cap for the Increased Claims.",
      },
    ])
    expect(
      completeIssues({ increasedClaims: none, increasedCap: noCap })
    ).toBeUndefined()
  })

  it("requires a General Cap Amount, since an empty one means no cap", () => {
    const { generalCap: _cap, ...rest } = example

    expect(partnership.schema.safeParse(rest).success).toBe(false)
  })

  it("prints each party's Covered Claims on its own labeled line", () => {
    const section = render(partnership, example).coverPage.sections.find(
      (candidate) => candidate.heading === "Covered Claims"
    )

    expect(
      section?.lines.map((line) => [
        line.label,
        line.parts.map((part) => part.text).join(""),
      ])
    ).toEqual([
      [
        "Company Covered Claim(s)",
        "Any action, suit, proceeding, or claim that arises out of or relates to (a) Company’s gross negligence or willful misconduct; or (b) Company’s breach or alleged breach of its representations and warranties in Section 7, including the intellectual property representations or warranties.",
      ],
      [
        "Partner Covered Claim(s)",
        "Any action, suit, proceeding, or claim that arises out of or relates to Partner's breach of its representations and warranties in Section 7.",
      ],
    ])
  })
})
