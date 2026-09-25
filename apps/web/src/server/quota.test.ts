import { Temporal } from "temporal-polyfill"
import { describe, expect, it } from "vite-plus/test"

import { decideExport, FREE_DOCUMENTS_PER_MONTH, monthStart } from "./quota"

describe("monthStart", () => {
  it("is midnight UTC on the first of the month", () => {
    expect(
      monthStart(Temporal.Instant.from("2026-09-25T13:45:10Z")).toString()
    ).toBe("2026-09-01T00:00:00Z")
  })

  it("follows UTC, not the local day: 23:30 in New York on the 31st is next month", () => {
    const newYork = Temporal.ZonedDateTime.from(
      "2026-10-31T23:30:00-04:00[America/New_York]"
    )

    expect(monthStart(newYork.toInstant()).toString()).toBe(
      "2026-11-01T00:00:00Z"
    )
  })

  it("keeps the first moment of a month in that month", () => {
    expect(
      monthStart(Temporal.Instant.from("2026-02-01T00:00:00Z")).toString()
    ).toBe("2026-02-01T00:00:00Z")
  })

  it("keeps the last moment of a month in that month", () => {
    expect(
      monthStart(Temporal.Instant.from("2026-12-31T23:59:59.999Z")).toString()
    ).toBe("2026-12-01T00:00:00Z")
  })
})

describe("decideExport", () => {
  const free = { plan: "free", format: "pdf", counted: false } as const

  it("allows 3 documents a month on the free plan", () => {
    expect(FREE_DOCUMENTS_PER_MONTH).toBe(3)
  })

  it("counts a free user's first export of a document", () => {
    expect(decideExport({ ...free, usedThisMonth: 0 })).toEqual({
      ok: true,
      counts: true,
    })
  })

  it("lets the third document of the month through", () => {
    expect(decideExport({ ...free, usedThisMonth: 2 })).toEqual({
      ok: true,
      counts: true,
    })
  })

  it("stops the fourth document of the month", () => {
    expect(decideExport({ ...free, usedThisMonth: 3 })).toEqual({
      ok: false,
      error: "QUOTA_EXCEEDED",
    })
  })

  it("lets a counted document through again for free, even over the limit", () => {
    expect(decideExport({ ...free, counted: true, usedThisMonth: 3 })).toEqual({
      ok: true,
      counts: false,
    })
  })

  it("keeps Word files for Pro", () => {
    expect(decideExport({ ...free, format: "docx", usedThisMonth: 0 })).toEqual(
      { ok: false, error: "PRO_REQUIRED" }
    )
  })

  it("keeps Word files for Pro, also for a counted document", () => {
    expect(
      decideExport({ ...free, format: "docx", counted: true, usedThisMonth: 0 })
    ).toEqual({ ok: false, error: "PRO_REQUIRED" })
  })

  it("gives Pro unlimited documents, each still counted once", () => {
    expect(
      decideExport({
        plan: "pro",
        format: "pdf",
        counted: false,
        usedThisMonth: 40,
      })
    ).toEqual({ ok: true, counts: true })
  })

  it("gives Pro Word files", () => {
    expect(
      decideExport({
        plan: "pro",
        format: "docx",
        counted: true,
        usedThisMonth: 0,
      })
    ).toEqual({ ok: true, counts: false })
  })
})
