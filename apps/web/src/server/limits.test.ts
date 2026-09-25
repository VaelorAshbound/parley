import { fileURLToPath } from "node:url"

import { unstable_readConfig } from "wrangler"
import { describe, expect, it } from "vite-plus/test"

import { RATE_LIMITS } from "./limits"

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
