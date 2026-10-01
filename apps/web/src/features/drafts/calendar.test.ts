import { Temporal } from "temporal-polyfill"
import { describe, expect, test } from "vite-plus/test"

import {
  calendarKey,
  groupByDay,
  parseCalendarKey,
  readTimeZone,
  updatedLabel,
} from "./calendar"

const at = (iso: string) => ({ title: iso, updatedAt: new Date(iso) })

describe("groupByDay", () => {
  const today = Temporal.PlainDate.from("2026-09-25")

  test("puts drafts under Today, Yesterday, Last 7 days and Older, in order", () => {
    const drafts = [
      at("2026-09-25T09:00:00Z"),
      at("2026-09-24T18:00:00Z"),
      at("2026-09-20T12:00:00Z"),
      at("2026-09-18T12:00:00Z"),
      at("2026-09-17T12:00:00Z"),
      at("2025-01-01T12:00:00Z"),
    ]

    const groups = groupByDay(drafts, { today, timeZone: "UTC" })

    expect(
      groups.map(({ label, drafts }) => [
        label,
        drafts.map((draft) => draft.title),
      ])
    ).toEqual([
      ["Today", ["2026-09-25T09:00:00Z"]],
      ["Yesterday", ["2026-09-24T18:00:00Z"]],
      ["Last 7 days", ["2026-09-20T12:00:00Z", "2026-09-18T12:00:00Z"]],
      ["Older", ["2026-09-17T12:00:00Z", "2025-01-01T12:00:00Z"]],
    ])
  })

  test("uses the user's own calendar day, not the server's", () => {
    // 23:30 in London is already the next day in Berlin.
    const drafts = [at("2026-09-24T22:30:00Z")]

    expect(groupByDay(drafts, { today, timeZone: "Europe/Berlin" })).toEqual([
      { label: "Today", drafts },
    ])
    expect(groupByDay(drafts, { today, timeZone: "UTC" })).toEqual([
      { label: "Yesterday", drafts },
    ])
  })

  test("counts calendar days across a clock change", () => {
    // Europe/Berlin moves its clocks back on 2026-10-25.
    const drafts = [at("2026-10-24T22:30:00Z")]

    expect(
      groupByDay(drafts, {
        today: Temporal.PlainDate.from("2026-10-26"),
        timeZone: "Europe/Berlin",
      })
    ).toEqual([{ label: "Yesterday", drafts }])
  })

  test("leaves out empty groups", () => {
    expect(groupByDay([], { today, timeZone: "UTC" })).toEqual([])
  })

  test("shows a draft from a clock that runs ahead as today", () => {
    const drafts = [at("2026-09-26T01:00:00Z")]

    expect(groupByDay(drafts, { today, timeZone: "UTC" })).toEqual([
      { label: "Today", drafts },
    ])
  })
})

describe("updatedLabel", () => {
  const today = Temporal.PlainDate.from("2026-09-25")

  test("shows the time for today, the day for this year, and the year before that", () => {
    const label = (iso: string) =>
      updatedLabel(new Date(iso), { today, timeZone: "America/New_York" })

    expect(label("2026-09-25T13:05:00Z")).toBe("9:05 AM")
    expect(label("2026-09-02T13:05:00Z")).toBe("Sep 2")
    expect(label("2025-12-30T13:05:00Z")).toBe("Dec 30, 2025")
  })
})

describe("calendarKey", () => {
  test("round-trips a calendar through its key", () => {
    const calendar = {
      timeZone: "America/Argentina/Buenos_Aires",
      today: Temporal.PlainDate.from("2026-09-25"),
    }

    const back = parseCalendarKey(calendarKey(calendar))

    expect(back.timeZone).toBe(calendar.timeZone)
    expect(back.today.equals(calendar.today)).toBe(true)
  })
})

describe("readTimeZone", () => {
  test("keeps a real time zone", () => {
    expect(readTimeZone("Europe/Berlin")).toBe("Europe/Berlin")
  })

  test.each([undefined, "", "Mars/Olympus", "UTC; path=/"])(
    "falls back to UTC for %j",
    (value) => {
      expect(readTimeZone(value)).toBe("UTC")
    }
  )
})
