import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"
import { render } from "../src/render.ts"

const psa = definitions.psa

describe("the PSA", () => {
  it("won't let a company sign both sides", () => {
    expect(
      psa.draftSchema.safeParse({
        provider: { company: "Northwind" },
        customer: { company: " northwind " },
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
      psa.draftSchema.safeParse({
        increasedClaims: { selected: [{ option: increased }] },
        unlimitedClaims: { selected: [{ option: unlimited }] },
      })

    expect(claims("confidentiality", "confidentiality").error?.issues).toEqual([
      expect.objectContaining({
        path: ["unlimitedClaims"],
        message:
          "A claim can be an Increased Claim or an Unlimited Claim, not both.",
      }),
    ])
    expect(claims("confidentiality", "grossNegligence").success).toBe(true)
  })

  it("seeds only the options Common Paper pre-marks, with no numbers", () => {
    expect(initialValues(psa, { today: "2026-09-24" })).toEqual({
      sowDate: { option: "lastSignature" },
      sowTerm: { option: "fixed" },
      effectiveDate: { option: "lastSignature" },
      providerCoveredClaims: { option: "standard" },
      customerCoveredClaims: { option: "standard" },
      generalCapAmount: { option: "multiple" },
    })
  })

  it("shows the acceptance periods only when acceptance applies", () => {
    const headings = (
      values: Parameters<typeof render<typeof psa.fields>>[1]
    ) =>
      render(psa, values).coverPage.sections.map((section) => section.heading)
    const listed = {
      option: "listed",
      value: "A report.",
    } as const

    expect(headings({ deliverables: { option: "none" } })).not.toContain(
      "Drafts and Acceptance"
    )
    expect(
      headings({
        deliverables: listed,
        deliverableTerms: { selected: [{ option: "drafts" }] },
      })
    ).not.toContain("Rejection Period")
    expect(
      headings({
        deliverables: listed,
        deliverableTerms: { selected: [{ option: "acceptance" }] },
      })
    ).toEqual(
      expect.arrayContaining(["Rejection Period", "Resubmission Period"])
    )
  })
})
