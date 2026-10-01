import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { baa } from "../src/definitions/baa.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"

const example = baa.schema.parse(examples.baa)

const period = (amount: number, unit: string) =>
  baa.draftSchema.safeParse({ breachNotificationPeriod: { amount, unit } })

describe("the BAA", () => {
  it("seeds only the option Common Paper pre-marks", () => {
    expect(initialValues(baa, { today: "2026-09-24" })).toEqual({
      effectiveDate: { option: "lastSignature" },
    })
  })

  // Any duration stops at 999, so 999 hours (about 42 days) is the most.
  it.each([
    [999, "hours"],
    [38, "businessDays"],
    [60, "calendarDays"],
  ])("allows a breach notice of %i %s", (amount, unit) => {
    expect(period(amount, unit).success).toBe(true)
  })

  it.each([
    [39, "businessDays"],
    [61, "calendarDays"],
  ])("caps a breach notice of %i %s at 60 calendar days", (amount, unit) => {
    expect(period(amount, unit).error?.issues).toEqual([
      expect.objectContaining({
        path: ["breachNotificationPeriod"],
        message: "At most 60 calendar days (38 business days or 1,440 hours).",
      }),
    ])
  })

  it("offers only hours, business days and calendar days", () => {
    expect(period(1, "weeks").success).toBe(false)
  })

  it("won't let a company be both Provider and Company", () => {
    expect(
      baa.draftSchema.safeParse({
        provider: { company: "Cedar Care" },
        company: { company: "CEDAR CARE " },
      }).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ["company"],
        message: "The two parties must be different companies.",
      }),
    ])
  })

  it("prints each role as the official sentence with its pick", () => {
    expect(
      render(baa, example).coverPage.sections.find(
        (section) => section.heading === "Relationship"
      )?.lines
    ).toMatchObject([
      { parts: [{ text: "Provider is a " }, { text: "Business Associate" }] },
      { parts: [{ text: "Company is a " }, { text: "Covered Entity" }] },
    ])
  })

  it("won't sign a subcontractor straight to a Covered Entity", () => {
    const pair = {
      providerRole: "subcontractor",
      companyRole: "coveredEntity",
    }

    expect(baa.draftSchema.safeParse(pair).success).toBe(true)
    expect(baa.schema.safeParse({ ...example, ...pair }).error?.issues).toEqual(
      [
        expect.objectContaining({
          path: ["companyRole"],
          message:
            "A subcontractor works for a Business Associate, so Company is one.",
        }),
      ]
    )
    expect(
      baa.schema.safeParse({
        ...example,
        ...pair,
        companyRole: "businessAssociate",
      }).success
    ).toBe(true)
  })
})
