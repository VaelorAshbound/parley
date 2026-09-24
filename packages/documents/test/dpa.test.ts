import { describe, expect, it } from "vite-plus/test"

import { initialValues, type DraftValues } from "../src/define.ts"
import { dpa } from "../src/definitions/dpa.ts"
import { render } from "../src/render.ts"

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

  it("offers the 27 EU member states for the governing member state", () => {
    expect(Object.keys(dpa.fields.governingMemberState.options)).toHaveLength(
      27
    )
  })
})
