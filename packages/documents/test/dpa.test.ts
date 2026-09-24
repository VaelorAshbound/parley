import { describe, expect, it } from "vite-plus/test"

import { initialValues, type DraftValues } from "../src/define.ts"
import { dpa } from "../src/definitions/dpa.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const example = dpa.schema.parse(examples.dpa)
/**
 * The issues a complete DPA gets once `change` is applied to the example; an
 * `undefined` in `change` leaves that field out.
 */
const completeIssues = (change: Record<string, unknown>) =>
  dpa.schema
    .safeParse(
      Object.fromEntries(
        Object.entries({ ...example, ...change }).filter(
          ([, value]) => value !== undefined
        )
      )
    )
    .error?.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))

const headings = (values: DraftValues<typeof dpa.fields>) =>
  render(dpa, values).coverPage.sections.map((section) => section.heading)

describe("the DPA", () => {
  it("seeds only the options Common Paper pre-marks", () => {
    expect(initialValues(dpa, { today: "2026-09-24" })).toEqual({
      approvedSubprocessors: { option: "online" },
      securityPolicy: { selected: [{ option: "agreement" }] },
      processingDuration: { option: "standard" },
      supervisoryAuthority: { option: "dataExporter" },
      securityMeasures: { selected: [{ option: "securityPolicy" }] },
    })
  })

  it("shows the subprocessor table only for a listed choice", () => {
    expect(
      headings({ approvedSubprocessors: { option: "online" } })
    ).not.toContain("Subprocessors")
    expect(headings({ approvedSubprocessors: { option: "listed" } })).toContain(
      "Subprocessors"
    )
  })

  it("shows the safeguards row only when special category data is processed", () => {
    const row = "Special Category Data Restrictions or Safeguards"

    expect(headings({ specialCategoryData: { option: "no" } })).not.toContain(
      row
    )
    expect(headings({ specialCategoryData: { option: "yes" } })).toContain(row)
  })

  it("shows the described measures only when that option is picked", () => {
    const row = "Described Security Measures"

    expect(headings(initialValues(dpa, { today: "2026-09-24" }))).not.toContain(
      row
    )
    expect(
      headings({ securityMeasures: { selected: [{ option: "described" }] } })
    ).toContain(row)
  })

  it("won't let a company be both Provider and Customer", () => {
    expect(
      dpa.draftSchema.safeParse({
        provider: { company: "Northwind" },
        customer: { company: " northwind " },
      }).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ["customer"],
        message: "The two parties must be different companies.",
      }),
    ])
    expect(
      dpa.draftSchema.safeParse({ customer: { company: "Northwind" } }).success
    ).toBe(true)
  })

  it("picks the member state, UK law and Customer's role from a list", () => {
    expect(dpa.fields.governingMemberState.kind).toBe("select")
    expect(Object.keys(dpa.fields.governingMemberState.options)).toHaveLength(
      27
    )
    expect(dpa.fields.ukTransfers.kind).toBe("select")
    expect(dpa.fields.customerRole.kind).toBe("select")
    expect(
      render(dpa, example).coverPage.sections.find(
        (section) => section.heading === "Governing Member State"
      )
    ).toMatchObject({
      lines: [
        { label: "EEA Transfers", parts: [{ text: "Ireland" }] },
        {
          label: "UK Transfers",
          parts: [{ text: "Laws of England and Wales" }],
        },
      ],
    })
  })

  it("needs the safeguards once special category data is Yes", () => {
    const message =
      "Special category data is processed, so name its safeguards."
    const draft = { specialCategoryData: { option: "yes" } }

    expect(dpa.draftSchema.safeParse(draft).success).toBe(true)
    expect(
      completeIssues({ ...draft, specialCategorySafeguards: undefined })
    ).toEqual([{ path: ["specialCategorySafeguards"], message }])
    expect(
      completeIssues({
        specialCategoryData: { option: "no" },
        specialCategorySafeguards: undefined,
      })
    ).toBeUndefined()
  })

  it("needs the subprocessor table once the listed option is picked", () => {
    expect(completeIssues({ subprocessors: undefined })).toEqual([
      {
        path: ["subprocessors"],
        message: "List each Approved Subprocessor, or link to a list.",
      },
    ])
    expect(
      completeIssues({
        approvedSubprocessors: { option: "none" },
        subprocessors: undefined,
      })
    ).toBeUndefined()
  })

  it("needs the described measures once that option is picked", () => {
    expect(completeIssues({ securityMeasureDetails: undefined })).toEqual([
      {
        path: ["securityMeasureDetails"],
        message: "Describe at least one security measure.",
      },
    ])
    expect(completeIssues({ securityMeasureDetails: {} })).toEqual([
      {
        path: ["securityMeasureDetails"],
        message: "Describe at least one security measure.",
      },
    ])
    expect(
      completeIssues({
        securityMeasures: { selected: [{ option: "securityPolicy" }] },
        securityMeasureDetails: undefined,
      })
    ).toBeUndefined()
  })

  it("needs each party's postal address, which the SCCs' Annex I(A) asks for", () => {
    const { address: _customer, ...customer } = example.customer ?? {}
    const { address: _provider, ...provider } = example.provider ?? {}

    expect(dpa.draftSchema.safeParse({ customer, provider }).success).toBe(true)
    expect(completeIssues({ customer, provider })).toEqual([
      {
        path: ["customer"],
        message: "Add Customer's postal address for Annex I(A).",
      },
      {
        path: ["provider"],
        message: "Add Provider's postal address for Annex I(A).",
      },
    ])
  })

  it("needs a DPA covered claim for a DPA liability cap to cap", () => {
    const draft = { coveredClaim: { option: "none" } }

    expect(dpa.draftSchema.safeParse(draft).success).toBe(true)
    expect(completeIssues(draft)).toEqual([
      {
        path: ["liabilityCap"],
        message: "A DPA liability cap needs a DPA covered claim.",
      },
    ])
    expect(
      completeIssues({ ...draft, liabilityCap: { option: "none" } })
    ).toBeUndefined()
  })
})
