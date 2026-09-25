import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { createAuth } from "../../web/src/server/auth"
import { GUEST_DRAFTS, GUESTS_PER_NETWORK } from "../../web/src/server/limits"
import {
  browserClient,
  call,
  database,
  origin,
  signInGuest,
  signUpUser,
} from "./helpers"

// Spec §2 Limits, each at its edge (T27): the last request that fits
// passes, and the next one is refused with a typed answer.

function randomIp() {
  return `198.51.100.${Math.floor(Math.random() * 250) + 1}`
}

const today = "2026-09-25"

describe("a guest's drafts", () => {
  it(`keeps ${GUEST_DRAFTS}; the next asks for an account`, async () => {
    const client = browserClient((await signInGuest()).cookie)
    await client.drafts.create({ documentId: "mutual-nda", today })

    const error = await client.drafts
      .create({ documentId: "mutual-nda", today })
      .catch((each: unknown) => each)

    expect(error).toMatchObject({
      code: "DRAFT_LIMIT",
      status: 403,
      defined: true,
      data: { limit: GUEST_DRAFTS },
    })
    expect(await client.drafts.list({})).toHaveLength(GUEST_DRAFTS)
  })

  it("two at once make one draft", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const results = await Promise.allSettled([
      client.drafts.create({ today }),
      client.drafts.create({ today }),
    ])

    expect(results.map((each) => each.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ])
    expect(await client.drafts.list({})).toHaveLength(1)
  })

  it("can't be copied", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })

    await expect(
      client.drafts.duplicate({ id: draft.id })
    ).rejects.toMatchObject({ code: "DRAFT_LIMIT", defined: true })
  })

  it("has room again once the draft is deleted", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })
    await client.drafts.delete({ id: draft.id })

    await expect(client.drafts.create({ today })).resolves.toBeDefined()
  })

  it("an account has no draft limit", async () => {
    const client = browserClient((await signUpUser()).cookie)

    for (let draft = 1; draft <= 3; draft++)
      await client.drafts.create({ today })

    expect(await client.drafts.list({})).toHaveLength(3)
  })
})

describe("new guests from one network", () => {
  /** Better Auth with production's real Turnstile widget. */
  async function productionAuth() {
    const db = await database()
    return createAuth({
      db,
      env: { ...env, STAGE: "production", TURNSTILE_SECRET_KEY: "0x4AAA-real" },
      waitUntil: () => {},
    })
  }

  function newGuest(auth: ReturnType<typeof createAuth>, ip: string) {
    return auth.handler(
      new Request(`${origin}/api/auth/sign-in/anonymous`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "cf-connecting-ip": ip,
          "x-captcha-response": "pass:parley.runtimedrift.dev:auth",
        },
        body: "{}",
      })
    )
  }

  it(`production lets ${GUESTS_PER_NETWORK.max} in, then asks the next to wait an hour`, async () => {
    const auth = await productionAuth()
    const ip = randomIp()

    for (let guest = 1; guest <= GUESTS_PER_NETWORK.max; guest++)
      expect((await newGuest(auth, ip)).status).toBe(200)
    const refused = await newGuest(auth, ip)

    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get("x-retry-after"))).toBeGreaterThan(
      GUESTS_PER_NETWORK.window - 60
    )
    // Another network is not held up.
    expect((await newGuest(auth, randomIp())).status).toBe(200)
  })

  it("test deployments (local, Previews) let the e2e runs through", async () => {
    const ip = randomIp()
    const newTestGuest = () =>
      call("/api/auth/sign-in/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": ip },
        body: "{}",
      })

    // Better Auth's own sign-in limit would stop the 4th.
    for (let guest = 1; guest <= 30; guest++)
      expect((await newTestGuest()).status).toBe(200)

    expect((await newTestGuest()).status).toBe(429)
  })
})
