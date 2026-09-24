import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"
import { render } from "../src/render.ts"

const license = definitions["software-license-agreement"]

describe("the Software License Agreement", () => {
  it("won't let a company sign both sides", () => {
    expect(
      license.draftSchema.safeParse({
        provider: { company: "Quill" },
        customer: { company: "QUILL" },
      }).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ["customer"],
        message: "The two parties must be different companies.",
      }),
    ])
  })

  it("won't put one claim under both Increased and Unlimited Claims", () => {
    const claims = (increased: string, unlimited: string) =>
      license.draftSchema.safeParse({
        increasedClaims: { selected: [{ option: increased }] },
        unlimitedClaims: { selected: [{ option: unlimited }] },
      })

    expect(claims("licenseBreach", "licenseBreach").error?.issues).toEqual([
      expect.objectContaining({
        path: ["unlimitedClaims"],
        message:
          "A claim can be an Increased Claim or an Unlimited Claim, not both.",
      }),
    ])
    expect(claims("confidentiality", "indemnification").success).toBe(true)
  })

  it("takes one kind of fee increase, with or without taxes", () => {
    const fees = (...options: string[]) =>
      license.draftSchema.safeParse({
        feeTerms: { selected: options.map((option) => ({ option })) },
      })

    expect(fees("increaseUpTo", "increaseFixed").error?.issues).toEqual([
      expect.objectContaining({
        path: ["feeTerms"],
        message: "Pick one kind of fee increase, not both.",
      }),
    ])
    expect(fees("increaseFixed", "includeTaxes").success).toBe(true)
  })

  it("seeds only the options Common Paper pre-marks, with no numbers", () => {
    expect(initialValues(license, { today: "2026-09-24" })).toEqual({
      orderDate: { option: "lastSignature" },
      autoRenewal: { option: "notice" },
      permittedUses: { option: "internal" },
      warrantyPeriod: { option: "fromDelivery" },
      effectiveDate: { option: "lastSignature" },
      providerCoveredClaims: { option: "standard" },
      generalCapAmount: { option: "multiple" },
      increasedClaims: { selected: [{ option: "confidentiality" }] },
      increasedCapAmount: { option: "multiple" },
      unlimitedClaims: { selected: [{ option: "indemnification" }] },
    })
  })

  it("prints the payment process as Common Paper's sentence", () => {
    const [invoice] =
      render(license, {
        paymentProcess: {
          option: "invoice",
          value: {
            frequency: { option: "oncePerPeriod" },
            days: { amount: 45, unit: "days" },
            from: { option: "invoiceDate" },
          },
        },
      }).coverPage.sections.find(
        (section) => section.heading === "Payment Process"
      )?.lines ?? []

    expect(invoice?.parts.map((part) => part.text).join("")).toBe(
      "Pay by invoice. Provider will invoice Customer once per Subscription Period. Customer will pay each invoice within 45 days from the invoice date."
    )
  })
})
