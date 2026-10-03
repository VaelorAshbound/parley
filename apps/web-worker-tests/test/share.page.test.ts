import { exports } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { RATE_LIMITS } from "../../web/src/server/limits"
import { browserClient, roomInWindow, signUpVerified } from "./helpers"

// The share page, /s/:token, as the real Worker serves it: src/server.ts
// and TanStack Start's SSR, which calls share.view in the same process.

const today = "2026-09-25"
const unknown = "AAAAAAAAAAAAAAAAAAAAAA"
const { limit, period } = RATE_LIMITS.SHARE_RATE_LIMITER

/** A page load from `ip` (Cloudflare's CF-Connecting-IP). */
async function open(path: string, ip: string) {
  const response = await exports.default.fetch(`http://localhost:3000${path}`, {
    headers: { "cf-connecting-ip": ip },
  })
  return {
    status: response.status,
    headers: response.headers,
    html: await response.text(),
  }
}

/** A link to a signed-up owner's Mutual NDA, "NDA with Bolt". */
async function sharedLink() {
  const owner = browserClient((await signUpVerified()).cookie)
  const draft = await owner.drafts.create({ documentId: "mutual-nda", today })
  await owner.drafts.rename({ id: draft.id, title: "NDA with Bolt" })
  const { token } = await owner.share.create({ id: draft.id })
  return token
}

describe("/s/:token", () => {
  it("shows the shared document", async () => {
    const token = await sharedLink()

    const page = await open(`/s/${token}`, "198.51.100.31")

    expect(page.status).toBe(200)
    expect(page.html).toContain("NDA with Bolt")
  })

  it("says a link that doesn't work doesn't work", async () => {
    const page = await open(`/s/${unknown}`, "198.51.100.32")

    expect(page.status).toBe(404)
    expect(page.html).toContain("This link doesn’t work")
  })
})

// PAR-13: past the limit the page says to wait, never "doesn't work": the
// link may be fine.
describe(`/s/:token past ${limit} views in ${period} s from one address`, () => {
  const timeout = (period + 60) * 1000

  async function useUpLimit(ip: string) {
    await roomInWindow(period, 30_000)
    for (let view = 0; view < limit; view += 1)
      expect((await open(`/s/${unknown}`, ip)).status).toBe(404)
  }

  it("says to wait a minute, with a 429", { timeout }, async () => {
    const token = await sharedLink()
    await useUpLimit("198.51.100.33")

    const page = await open(`/s/${token}`, "198.51.100.33")

    expect(page.html).toContain("Give it a minute")
    expect(page.headers.get("retry-after")).toBe(String(period))
    expect(page.status).toBe(429)
    expect(page.html).not.toContain("This link doesn’t work")
    expect(page.html).not.toContain("NDA with Bolt")
  })

  it("still shows the page to another address", { timeout }, async () => {
    const token = await sharedLink()
    await useUpLimit("198.51.100.34")

    const page = await open(`/s/${token}`, "198.51.100.35")

    expect(page.status).toBe(200)
    expect(page.html).toContain("NDA with Bolt")
  })
})
