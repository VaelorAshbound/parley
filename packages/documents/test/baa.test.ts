import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { baa } from "../src/definitions/baa.ts"

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
})
