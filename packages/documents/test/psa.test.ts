import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const psa = definitions.psa
const example = psa.schema.parse(examples.psa)
/** A complete PSA's issues with `keys` left out and `change` applied. */
const completeIssues = (keys: string[], change: object = {}) =>
  psa.schema
    .safeParse({
      ...Object.fromEntries(
        Object.entries(example).filter(([key]) => !keys.includes(key))
      ),
      ...change,
    })
    .error?.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))

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

  it("needs both acceptance periods once acceptance applies", () => {
    const periods = ["rejectionPeriod", "resubmissionPeriod"]

    expect(
      psa.draftSchema.safeParse({
        deliverableTerms: { selected: [{ option: "acceptance" }] },
      }).success
    ).toBe(true)
    expect(completeIssues(periods)).toEqual([
      {
        path: ["rejectionPeriod"],
        message: "Acceptance applies, so set the Rejection Period.",
      },
      {
        path: ["resubmissionPeriod"],
        message: "Acceptance applies, so set the Resubmission Period.",
      },
    ])
    expect(completeIssues([...periods, "deliverableTerms"])).toBeUndefined()
  })

  it("needs an Increased Cap Amount once there are Increased Claims", () => {
    const message =
      "There are Increased Claims, so set their Increased Cap Amount."

    expect(completeIssues(["increasedCapAmount"])).toEqual([
      { path: ["increasedCapAmount"], message },
    ])
    expect(
      completeIssues(["increasedCapAmount", "increasedClaims"], {
        increasedClaims: { selected: [], other: "Breach of Section 9." },
      })
    ).toEqual([{ path: ["increasedCapAmount"], message }])
    expect(
      completeIssues(["increasedCapAmount", "increasedClaims"])
    ).toBeUndefined()
  })
})
