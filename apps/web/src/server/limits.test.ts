import { fileURLToPath } from "node:url"

import { Temporal } from "temporal-polyfill"
import { unstable_readConfig } from "wrangler"
import { describe, expect, it } from "vite-plus/test"

import { RATE_LIMITS, usageDay } from "./limits"

// The Rate Limiting bindings' numbers are set in wrangler.jsonc; the code
// and tests read them from RATE_LIMITS. Both must say the same, for
// production and for Previews.

type RateLimitBinding = {
  name: string
  namespace_id: string
  simple: { limit: number; period: number }
}

const config = unstable_readConfig({
  config: fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)),
})
const production: RateLimitBinding[] = config.ratelimits
const previews: RateLimitBinding[] = config.previews?.ratelimits ?? []

function limitsOf(bindings: RateLimitBinding[]) {
  return Object.fromEntries(
    bindings.map(({ name, simple }) => [
      name,
      { limit: simple.limit, period: simple.period },
    ])
  )
}

describe("usageDay", () => {
  it("is the UTC day, and ends at the next UTC midnight", () => {
    expect(usageDay(Temporal.Instant.from("2026-09-25T13:45:00Z"))).toEqual({
      day: "2026-09-25",
      resetsAt: "2026-09-26T00:00:00.000Z",
    })
  })

  it("goes by UTC, not the user's evening", () => {
    // 23:30 in New York is already the next day in UTC.
    expect(
      usageDay(Temporal.Instant.from("2026-09-25T23:30:00-04:00")).day
    ).toBe("2026-09-26")
  })

  it("crosses a month end", () => {
    expect(
      usageDay(Temporal.Instant.from("2026-09-30T23:59:59Z")).resetsAt
    ).toBe("2026-10-01T00:00:00.000Z")
  })
})

describe("RATE_LIMITS", () => {
  it("matches production's bindings", () => {
    expect(limitsOf(production)).toEqual(RATE_LIMITS)
  })

  it("matches the Previews' bindings, on namespaces of their own", () => {
    const shared = previews.filter((preview) =>
      production.some((each) => each.namespace_id === preview.namespace_id)
    )

    expect(limitsOf(previews)).toEqual(RATE_LIMITS)
    expect(shared).toEqual([])
  })
})
