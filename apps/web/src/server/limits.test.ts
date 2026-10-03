import { fileURLToPath } from "node:url"

import { Temporal } from "temporal-polyfill"
import { unstable_readConfig } from "wrangler"
import { describe, expect, it } from "vite-plus/test"

import { RATE_LIMITS, clientAddress, usageDay } from "./limits"

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

describe("clientAddress", () => {
  const from = (ip: string) =>
    clientAddress(new Headers({ "cf-connecting-ip": ip }))

  it("is the whole IPv4 address", () => {
    expect(from("198.51.100.7")).toBe("198.51.100.7")
  })

  it("is the /64 of an IPv6 address: one network, one count", () => {
    expect(from("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64")
    expect(from("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64")
    expect(from("2001:0DB8:0001:0002:0:0:0:9")).toBe("2001:db8:1:2::/64")
  })

  it("tells IPv6 networks apart", () => {
    expect(from("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64")
    expect(from("2001:db8::1")).toBe("2001:db8:0:0::/64")
    expect(from("::1")).toBe("0:0:0:0::/64")
  })

  it("is the IPv4 address inside an IPv4-mapped IPv6 one", () => {
    expect(from("::ffff:198.51.100.7")).toBe("198.51.100.7")
  })

  it("keeps an address it can't read as it is", () => {
    expect(from("not-an-ip")).toBe("not-an-ip")
  })

  it("never reads a header the client can set", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.50",
      "x-real-ip": "203.0.113.51",
      "true-client-ip": "203.0.113.52",
    })
    expect(clientAddress(headers)).toBe("no-address")
  })
})
