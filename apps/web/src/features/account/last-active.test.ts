import { describe, expect, it } from "vite-plus/test"

import { lastActive } from "./last-active"

const now = new Date("2026-09-25T12:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

describe("lastActive", () => {
  it("says now for the last few minutes", () => {
    expect(lastActive(ago(4 * minute), now)).toBe("Active now")
  })

  it("counts minutes, hours, days, then months", () => {
    expect(lastActive(ago(12 * minute), now)).toBe("Active 12 minutes ago")
    expect(lastActive(ago(1 * hour), now)).toBe("Active 1 hour ago")
    expect(lastActive(ago(5 * hour + 50 * minute), now)).toBe(
      "Active 5 hours ago"
    )
    expect(lastActive(ago(1 * day), now)).toBe("Active yesterday")
    expect(lastActive(ago(6 * day), now)).toBe("Active 6 days ago")
    expect(lastActive(ago(45 * day), now)).toBe("Active last month")
  })

  it("never says the future (a clock a little ahead)", () => {
    expect(lastActive(new Date(now.getTime() + minute), now)).toBe("Active now")
  })
})
