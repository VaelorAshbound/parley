import { schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import checkoutCreated from "./fixtures/polar/checkout-created.json"
import customerSession from "./fixtures/polar/customer-session.json"
import canceledAtPeriodEnd from "./fixtures/polar/state-canceled-at-period-end.json"
import active from "./fixtures/polar/state-active.json"
import newCustomer from "./fixtures/polar/state-new-customer.json"
import revoked from "./fixtures/polar/state-revoked.json"
import {
  call,
  database,
  post,
  signInGuest,
  signUpUser,
  signUpVerified,
} from "./helpers"
import { deliver, fakePolarApi, sign, stateFor } from "./polar"

// Parley Pro through Polar's sandbox (spec §2 Limits, §4 Payments; T26).
// Polar's webhooks are the only way the plan changes: they are signed, may
// come twice, late, or out of order, and the newest state wins.

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

async function userIdOf(email: string) {
  const db = await database()
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
  if (!row) throw new Error(`No user ${email}`)
  return row.id
}

async function planOf(userId: string) {
  const db = await database()
  const [row] = await db
    .select({ plan: schema.user.plan })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  return row?.plan
}

type State = typeof active | typeof canceledAtPeriodEnd | typeof revoked

/** A verified account that Polar's sandbox reports as `state`. */
async function accountWith(state: State) {
  const account = await signUpVerified()
  const userId = await userIdOf(account.email)
  expect((await deliver(stateFor(state, userId))).status).toBe(200)
  return { ...account, userId }
}

describe("Polar's webhook", () => {
  it("turns Pro on when the subscription is active", async () => {
    const { email } = await signUpVerified()
    const userId = await userIdOf(email)

    const response = await deliver(stateFor(active, userId))

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("keeps Pro after a cancel, until the paid month ends", async () => {
    const { userId } = await accountWith(active)

    await deliver(stateFor(canceledAtPeriodEnd, userId))

    expect(await planOf(userId)).toBe("pro")
  })

  it("turns Pro off when the subscription is revoked", async () => {
    const { userId } = await accountWith(canceledAtPeriodEnd)

    await deliver(stateFor(revoked, userId))

    expect(await planOf(userId)).toBe("free")
  })

  it("is the same when Polar delivers a state twice", async () => {
    const { userId } = await accountWith(active)

    const again = await deliver(stateFor(active, userId))

    expect(again.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("ignores an older state that arrives late", async () => {
    // As seen in the sandbox: a retry of the first state (no subscription
    // yet) arrived after the state with the new subscription.
    const { userId } = await accountWith(active)

    const late = await deliver(stateFor(newCustomer, userId))

    expect(late.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("gives no Pro for a subscription to another product", async () => {
    const { email } = await signUpVerified()
    const userId = await userIdOf(email)
    const other = stateFor(active, userId)
    const [subscription] = other.data.active_subscriptions
    if (!subscription) throw new Error("fixture has a subscription")
    other.data.active_subscriptions = [
      { ...subscription, product_id: crypto.randomUUID() },
    ]

    await deliver(other)

    expect(await planOf(userId)).toBe("free")
  })

  it("accepts a customer that isn't a Parley user, and changes nothing", async () => {
    expect((await deliver(stateFor(active, null))).status).toBe(200)
    expect((await deliver(stateFor(active, "no-such-user"))).status).toBe(200)
  })

  it("refuses a body that isn't signed with Parley's secret", async () => {
    const { email } = await signUpVerified()
    const userId = await userIdOf(email)
    const body = JSON.stringify(stateFor(active, userId))

    const forged = await deliver(
      JSON.parse(body),
      await sign(body, { secret: "polar_whs_someone_else" })
    )

    expect(forged.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses a signed body that was changed on the way", async () => {
    const { email } = await signUpVerified()
    const userId = await userIdOf(email)
    const signedFor = await sign(JSON.stringify(stateFor(revoked, userId)))

    const changed = await deliver(stateFor(active, userId), signedFor)

    expect(changed.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses an old signed delivery replayed later", async () => {
    const { email } = await signUpVerified()
    const userId = await userIdOf(email)
    const body = JSON.stringify(stateFor(active, userId))
    const hourAgo = Math.floor(Date.now() / 1000) - 60 * 60

    const replayed = await deliver(
      JSON.parse(body),
      await sign(body, { timestamp: hourAgo })
    )

    expect(replayed.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses a delivery with no signature", async () => {
    const replay = await call("/api/auth/polar/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(stateFor(active, "someone")),
    })

    expect(replay.status).toBe(400)
  })
})

describe("the plan in the session", () => {
  it("reads Pro from the database on a fresh session read", async () => {
    const { cookie } = await accountWith(active)

    const response = await call(
      "/api/auth/get-session?disableCookieCache=true",
      {
        headers: { cookie },
      }
    )

    expect(
      ((await response.json()) as { user: { plan: string } }).user.plan
    ).toBe("pro")
  })

  it("can't be set by the user", async () => {
    const { cookie, userId } = await signUpVerified().then(async (account) => ({
      ...account,
      userId: await userIdOf(account.email),
    }))

    const response = await post(
      "/api/auth/update-user",
      { plan: "pro" },
      cookie
    )

    expect(response.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("can't be chosen at sign-up", async () => {
    const email = `ana-${crypto.randomUUID()}@example.test`
    await post("/api/auth/sign-up/email", {
      name: "Ana",
      email,
      password: "correct horse 1",
      plan: "pro",
    })

    const db = await database()
    const rows = await db
      .select({ plan: schema.user.plan })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    expect(rows.map((row) => row.plan)).not.toContain("pro")
  })
})

describe("checkout", () => {
  function fakeCheckout() {
    const polar = fakePolarApi(({ method, path }) =>
      method === "POST" && path === "/v1/checkouts/"
        ? Response.json(checkoutCreated, { status: 201 })
        : undefined
    )
    restore = polar.restore
    return polar
  }

  it("sends a verified free user to Polar's checkout for Pro", async () => {
    const polar = fakeCheckout()
    const { cookie, email } = await signUpVerified()
    const userId = await userIdOf(email)

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      url: checkoutCreated.url,
      redirect: true,
    })
    expect(polar.calls).toHaveLength(1)
    expect(polar.calls[0]?.body).toMatchObject({
      products: [checkoutCreated.product_id],
      external_customer_id: userId,
      success_url: "http://localhost:3000/pricing?checkout_id={CHECKOUT_ID}",
      return_url: "http://localhost:3000/pricing",
    })
  })

  it("asks a guest to sign in", async () => {
    const polar = fakeCheckout()
    const { cookie } = await signInGuest()

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(401)
    expect(polar.calls).toHaveLength(0)
  })

  it("asks for a confirmed email first", async () => {
    const polar = fakeCheckout()
    const { cookie } = await signUpUser()

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(403)
    expect(((await response.json()) as { code: string }).code).toBe(
      "EMAIL_NOT_VERIFIED"
    )
    expect(polar.calls).toHaveLength(0)
  })

  it("never sells Pro twice", async () => {
    const { cookie } = await accountWith(active)
    const polar = fakeCheckout()

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(409)
    expect(((await response.json()) as { code: string }).code).toBe(
      "ALREADY_PRO"
    )
    expect(polar.calls).toHaveLength(0)
  })

  it.each([
    ["a free trial", { trialInterval: "year", trialIntervalCount: 1000 }],
    ["another product", { products: [crypto.randomUUID()] }],
    ["its own return page", { successUrl: "https://evil.example/" }],
    ["a discount", { discountId: crypto.randomUUID() }],
    ["checkout metadata", { metadata: { plan: "pro" } }],
  ])("refuses a request that asks for %s", async (_, extra) => {
    const polar = fakeCheckout()
    const { cookie } = await signUpVerified()

    const response = await post(
      "/api/auth/checkout",
      { slug: "pro", ...extra },
      cookie
    )

    expect(response.status).toBe(400)
    expect(polar.calls).toHaveLength(0)
  })
})

describe("the billing portal", () => {
  it("opens Polar's portal for a Pro user", async () => {
    const polar = fakePolarApi(({ method, path }) =>
      method === "POST" && path === "/v1/customer-sessions/"
        ? Response.json(customerSession, { status: 201 })
        : undefined
    )
    restore = polar.restore
    const { cookie, userId } = await accountWith(active)

    const response = await post("/api/auth/customer/portal", {}, cookie)

    expect(response.status).toBe(200)
    expect(((await response.json()) as { url: string }).url).toBe(
      customerSession.customer_portal_url
    )
    expect(polar.calls[0]?.body).toMatchObject({
      external_customer_id: userId,
      return_url: "http://localhost:3000/pricing",
    })
  })

  it.each([
    "/api/auth/customer/state",
    "/api/auth/customer/benefits/list",
    "/api/auth/customer/orders/list",
    "/api/auth/customer/subscriptions/list?referenceId=someone-else",
  ])("keeps %s closed: Parley doesn't use it", async (path) => {
    const polar = fakePolarApi()
    restore = polar.restore
    const { cookie } = await signUpVerified()

    const response = await call(path, { headers: { cookie } })

    expect(response.status).toBe(404)
    expect(polar.calls).toHaveLength(0)
  })
})

describe("deleting the account", () => {
  it("cancels Polar billing with it, so a deleted user is never charged", async () => {
    const polar = fakePolarApi(({ method, path }) =>
      method === "DELETE" && path.startsWith("/v1/customers/external/")
        ? new Response(null, { status: 204 })
        : undefined
    )
    restore = polar.restore
    const { cookie, userId } = await accountWith(active)

    const response = await post(
      "/api/auth/delete-user",
      { password: "correct horse 1" },
      cookie
    )

    expect(response.status).toBe(200)
    expect(polar.calls).toEqual([
      {
        method: "DELETE",
        path: `/v1/customers/external/${userId}?anonymize=true`,
        body: undefined,
      },
    ])
    expect(await planOf(userId)).toBeUndefined()
  })

  it("keeps the account when Polar can't cancel the billing yet", async () => {
    const polar = fakePolarApi(() =>
      Response.json({ detail: "down" }, { status: 503 })
    )
    restore = polar.restore
    const { cookie, userId } = await accountWith(active)

    const response = await post(
      "/api/auth/delete-user",
      { password: "correct horse 1" },
      cookie
    )

    expect(response.status).toBe(503)
    expect(await planOf(userId)).toBe("pro")
  })

  it("deletes a user Polar has no customer for", async () => {
    const polar = fakePolarApi(() =>
      Response.json(
        { error: "ResourceNotFound", detail: "Not found" },
        { status: 404 }
      )
    )
    restore = polar.restore
    const { cookie, userId } = await accountWith(revoked)

    const response = await post(
      "/api/auth/delete-user",
      { password: "correct horse 1" },
      cookie
    )

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBeUndefined()
  })

  it("never calls Polar for a user who never bought", async () => {
    const polar = fakePolarApi()
    restore = polar.restore
    const { cookie } = await signUpVerified()

    const response = await post(
      "/api/auth/delete-user",
      { password: "correct horse 1" },
      cookie
    )

    expect(response.status).toBe(200)
    expect(polar.calls).toHaveLength(0)
  })
})
