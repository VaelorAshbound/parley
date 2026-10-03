import { schema } from "@workspace/db"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cancelBilling } from "../../web/src/server/billing"
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
import { deliver, fakePolar, send, sign, stateFor } from "./polar"

// Parley Pro through Polar's sandbox (spec §2 Limits, §4 Payments; T26).
// Polar's webhooks are the only way the plan changes. Each is only a sign
// that something changed: Parley reads the customer's current state from
// Polar, so a retry, a duplicate or a late delivery can't undo it.

let polar: ReturnType<typeof fakePolar>
beforeEach(() => {
  polar = fakePolar()
})
afterEach(() => polar.restore())

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
  expect((await send(polar, stateFor(state, userId))).status).toBe(200)
  polar.forget()
  return { ...account, userId, customerId: `cus-${userId}` }
}

async function newAccount() {
  const account = await signUpVerified()
  return { ...account, userId: await userIdOf(account.email) }
}

/**
 * The state with its subscriptions sold by `stage`: checkout stamps the
 * stage in its metadata, and Polar copies it to the subscription.
 */
function soldBy<T extends { data: { active_subscriptions: object[] } }>(
  state: T,
  stage: string
) {
  return {
    ...state,
    data: {
      ...state.data,
      active_subscriptions: state.data.active_subscriptions.map((each) => ({
        ...each,
        metadata: { stage },
      })),
    },
  }
}

const deleted = (userId: string) => ({
  method: "DELETE",
  path: `/v1/customers/cus-${userId}?anonymize=true`,
  body: undefined,
})

describe("Polar's webhook", () => {
  it("turns Pro on when the subscription is active", async () => {
    const { userId } = await newAccount()

    const response = await send(polar, stateFor(active, userId))

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("turns Pro on during a free trial", async () => {
    const { userId } = await newAccount()
    const trial = stateFor(active, userId)
    trial.data.active_subscriptions = trial.data.active_subscriptions.map(
      (subscription) => ({ ...subscription, status: "trialing" })
    )

    await send(polar, trial)

    expect(await planOf(userId)).toBe("pro")
  })

  it("gives no Pro to a customer deleted in Polar, whatever it still lists", async () => {
    const { userId } = await accountWith(active)
    const base = stateFor(active, userId)
    const gone = {
      ...base,
      data: { ...base.data, deleted_at: new Date().toISOString() },
    }

    await send(polar, gone)

    expect(await planOf(userId)).toBe("free")
  })

  it("keeps Pro after a cancel, until the paid month ends", async () => {
    const { userId } = await accountWith(active)

    await send(polar, stateFor(canceledAtPeriodEnd, userId))

    expect(await planOf(userId)).toBe("pro")
  })

  it("turns Pro off when the subscription is revoked", async () => {
    const { userId } = await accountWith(canceledAtPeriodEnd)

    await send(polar, stateFor(revoked, userId))

    expect(await planOf(userId)).toBe("free")
  })

  it("is the same when Polar delivers a state twice", async () => {
    const { userId } = await accountWith(active)

    const again = await deliver(stateFor(active, userId))

    expect(again.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("reads the current state, so a late delivery can't undo a newer one", async () => {
    // As seen in the sandbox: a retry of the first state (no subscription
    // yet) arrived after the state with the new subscription.
    const { userId } = await accountWith(active)

    const late = await deliver(stateFor(newCustomer, userId))

    expect(late.status).toBe(200)
    expect(await planOf(userId)).toBe("pro")
  })

  it("follows Polar's current state even when the delivery says otherwise", async () => {
    const { userId } = await accountWith(active)
    polar.states.set(`cus-${userId}`, stateFor(revoked, userId).data)

    // Two changes in the same millisecond, delivered in the wrong order.
    await deliver(stateFor(active, userId))

    expect(await planOf(userId)).toBe("free")
  })

  it("gives no Pro for a subscription to another product", async () => {
    const { userId } = await newAccount()
    const other = stateFor(active, userId)
    const [subscription] = other.data.active_subscriptions
    if (!subscription) throw new Error("fixture has a subscription")
    other.data.active_subscriptions = [
      { ...subscription, product_id: crypto.randomUUID() },
    ]

    await send(polar, other)

    expect(await planOf(userId)).toBe("free")
  })

  it("turns Pro off for a customer deleted in Polar, found by its customer id", async () => {
    // Deleting a customer clears its external id (our user id).
    const { userId, customerId } = await accountWith(active)
    polar.states.delete(customerId)
    const base = stateFor(revoked, null, customerId)
    const gone = {
      ...base,
      data: { ...base.data, deleted_at: new Date().toISOString() },
    }

    const response = await deliver(gone)

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBe("free")
  })

  it("cancels a paid subscription whose Parley account is gone", async () => {
    // Checkout finished in one tab after the account was deleted in another.
    const ghost = crypto.randomUUID()
    polar.answer(({ method }) =>
      method === "DELETE" ? new Response(null, { status: 204 }) : undefined
    )

    const response = await send(
      polar,
      soldBy(stateFor(active, ghost), "production")
    )

    expect(response.status).toBe(200)
    expect(polar.calls).toContainEqual(deleted(ghost))
  })

  it("never cancels a subscription sold by another stage", async () => {
    // Previews and production share one Polar organization, and each gets
    // every webhook: a production buyer is unknown on a Preview's database
    // (Checkpoint 6 review). Sold before stages were stamped: unknown too.
    polar.answer(({ method }) =>
      method === "DELETE" ? new Response(null, { status: 204 }) : undefined
    )

    const other = await send(
      polar,
      soldBy(stateFor(active, crypto.randomUUID()), "preview")
    )
    const unstamped = await send(polar, stateFor(active, crypto.randomUUID()))

    expect([other.status, unstamped.status]).toEqual([200, 200])
    expect(polar.calls.map(({ method }) => method)).not.toContain("DELETE")
  })

  it("leaves alone a customer Parley didn't make", async () => {
    // Made by hand in Polar's dashboard: no external id.
    const response = await send(polar, stateFor(active, null))

    expect(response.status).toBe(200)
    expect(polar.calls.map(({ method }) => method)).not.toContain("DELETE")
  })

  it("asks Polar to send again when it can't read the state", async () => {
    const { userId } = await newAccount()
    polar.answer(({ method }) =>
      method === "GET"
        ? Response.json({ detail: "down" }, { status: 503 })
        : undefined
    )

    const response = await deliver(stateFor(active, userId))

    expect(response.status).toBe(500)
    expect(await planOf(userId)).toBe("free")
  })

  it("warns, without the payload, when a state change can't be read", async () => {
    // Signed by Polar, so it is acknowledged (a retry wouldn't read better),
    // but on-call must see it: a plan that never changes leaves no trace.
    using warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { email, userId } = await newAccount()
    const base = stateFor(active, userId)
    const unreadable = { ...base, data: { ...base.data, id: 42, email } }

    const response = await deliver(unreadable)

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBe("free")
    const lines = warn.mock.calls.map(([line]) => line as object)
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "polar_webhook_unreadable",
        type: "customer.state_changed",
        issues: "data.id",
      })
    )
    // Polar's payload holds the customer's email and name: never logged.
    expect(JSON.stringify(lines)).not.toContain(email)
    expect(JSON.stringify(lines)).not.toContain(userId)
  })

  it("reads a state change with no external id at all", async () => {
    // Polar may leave the field out instead of sending null; the customer
    // id still finds the user.
    const { userId } = await accountWith(active)
    const base = stateFor(revoked, userId)
    const { external_id: _, ...data } = base.data

    const response = await send(polar, { ...base, data })

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses a body that isn't signed with Parley's secret", async () => {
    const { userId } = await newAccount()
    const body = JSON.stringify(stateFor(active, userId))

    const forged = await deliver(
      JSON.parse(body),
      await sign(body, {
        secret: "whsec_c29tZW9uZSBlbHNlJ3Mgc2VjcmV0IGtleSBieXRlcw==",
      })
    )

    expect(forged.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses a signed body that was changed on the way", async () => {
    const { userId } = await newAccount()
    const signedFor = await sign(JSON.stringify(stateFor(revoked, userId)))

    const changed = await deliver(stateFor(active, userId), signedFor)

    expect(changed.status).toBe(400)
    expect(await planOf(userId)).toBe("free")
  })

  it("refuses an old signed delivery replayed later", async () => {
    const { userId } = await newAccount()
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
      { headers: { cookie } }
    )

    expect(
      ((await response.json()) as { user: { plan: string } }).user.plan
    ).toBe("pro")
  })

  it("never shows the Polar customer id", async () => {
    const { cookie } = await accountWith(active)

    const response = await call(
      "/api/auth/get-session?disableCookieCache=true",
      { headers: { cookie } }
    )

    expect(await response.text()).not.toContain("cus-")
  })

  it("can't be set by the user", async () => {
    const { cookie, userId } = await newAccount()

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
  beforeEach(() =>
    polar.answer(({ method, path }) =>
      method === "POST" && path === "/v1/checkouts/"
        ? Response.json(checkoutCreated, { status: 201 })
        : method === "POST" && path === "/v1/customers/"
          ? Response.json({ id: "cus-new" }, { status: 201 })
          : undefined
    )
  )

  /** The calls that made a checkout session. */
  const checkouts = () =>
    polar.calls.filter(({ path }) => path === "/v1/checkouts/")

  it("sends a verified free user to Polar's checkout for Pro", async () => {
    const { cookie, userId } = await newAccount()

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      url: checkoutCreated.url,
      redirect: true,
    })
    expect(checkouts()).toHaveLength(1)
    expect(checkouts()[0]?.body).toMatchObject({
      products: [checkoutCreated.product_id],
      external_customer_id: userId,
      success_url: "http://localhost:3000/pricing?checkout_id={CHECKOUT_ID}",
      return_url: "http://localhost:3000/pricing",
      // Parley has no discounts: the checkout page shows no code field.
      allow_discount_codes: false,
      // Polar copies it to the subscription: which stage sold it.
      metadata: { stage: "production" },
    })
  })

  it("asks a guest to sign in", async () => {
    const { cookie } = await signInGuest()

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(401)
    expect(polar.calls).toHaveLength(0)
  })

  it("asks for a confirmed email first", async () => {
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

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(409)
    expect(((await response.json()) as { code: string }).code).toBe(
      "ALREADY_PRO"
    )
    expect(polar.calls).toHaveLength(0)
  })

  it("stops one person from calling Polar over and over", async () => {
    // Each checkout is a call to Polar's API, whose limit is the whole
    // organization's. Counted per user, whatever network they are on.
    const { cookie } = await newAccount()
    const statuses = []
    for (const _ of Array.from({ length: 6 }))
      statuses.push(
        (await post("/api/auth/checkout", { slug: "pro" }, cookie)).status
      )

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    expect(checkouts()).toHaveLength(5)
  })

  it("fills in the confirmed email: the buyer is who Parley knows", async () => {
    const { cookie, email, userId } = await newAccount()

    await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(polar.calls[0]).toMatchObject({
      method: "POST",
      path: "/v1/customers/",
      body: { external_id: userId, email },
    })
  })

  it("still opens checkout when Polar already has this customer", async () => {
    const { cookie } = await newAccount()
    polar.answer(({ method, path }) =>
      path === "/v1/customers/"
        ? Response.json({ detail: "exists" }, { status: 422 })
        : method === "POST" && path === "/v1/checkouts/"
          ? Response.json(checkoutCreated, { status: 201 })
          : undefined
    )

    const response = await post("/api/auth/checkout", { slug: "pro" }, cookie)

    expect(response.status).toBe(200)
    expect(checkouts()).toHaveLength(1)
  })

  it.each([
    ["a free trial", { trialInterval: "year", trialIntervalCount: 1000 }],
    ["another product", { products: [crypto.randomUUID()] }],
    ["its own return page", { successUrl: "https://evil.example/" }],
    ["a discount", { discountId: crypto.randomUUID() }],
    ["discount codes", { allowDiscountCodes: true }],
    ["checkout metadata", { metadata: { plan: "pro" } }],
  ])("refuses a request that asks for %s", async (_, extra) => {
    const { cookie } = await newAccount()

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
  beforeEach(() =>
    polar.answer(({ method, path }) =>
      method === "POST" && path === "/v1/customer-sessions/"
        ? Response.json(customerSession, { status: 201 })
        : undefined
    )
  )

  it("opens Polar's portal for a Pro user", async () => {
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

  it("stays open after Pro ends, for past invoices", async () => {
    const { cookie } = await accountWith(revoked)

    const response = await post("/api/auth/customer/portal", {}, cookie)

    expect(response.status).toBe(200)
  })

  it("says there is no billing yet for someone who never bought", async () => {
    const { cookie } = await newAccount()

    const response = await post("/api/auth/customer/portal", {}, cookie)

    expect(response.status).toBe(404)
    expect(((await response.json()) as { code: string }).code).toBe(
      "NO_BILLING"
    )
    expect(polar.calls).toHaveLength(0)
  })

  it("can't be opened by a link from another site", async () => {
    // A GET passes the origin check, and cookies go with a link's GET.
    const { cookie } = await accountWith(active)

    const response = await call("/api/auth/customer/portal", {
      headers: { cookie },
    })

    expect(response.status).toBe(405)
    expect(polar.calls).toHaveLength(0)
  })

  it.each([
    "/api/auth/customer/state",
    "/api/auth/customer/benefits/list",
    "/api/auth/customer/orders/list",
    "/api/auth/customer/subscriptions/list?referenceId=someone-else",
  ])("keeps %s closed: Parley doesn't use it", async (path) => {
    const { cookie } = await newAccount()

    const response = await call(path, { headers: { cookie } })

    expect(response.status).toBe(404)
    expect(polar.calls).toHaveLength(0)
  })
})

describe("deleting the account", () => {
  function deleteUser(cookie: string) {
    return post(
      "/api/auth/delete-user",
      { password: "correct horse 1" },
      cookie
    )
  }

  beforeEach(() =>
    polar.answer(({ method, path }) =>
      method === "DELETE" && path.startsWith("/v1/customers/external/")
        ? new Response(null, { status: 204 })
        : undefined
    )
  )

  it("cancels Polar billing with it, so a deleted user is never charged", async () => {
    const { cookie, userId } = await accountWith(active)

    const response = await deleteUser(cookie)

    expect(response.status).toBe(200)
    const cancel = {
      method: "DELETE",
      path: `/v1/customers/external/${userId}?anonymize=true`,
      body: undefined,
    }
    // Once more after the row is gone: a checkout that finished in another
    // tab meanwhile made a new customer, and its webhook may have come
    // while the row was still there (Checkpoint 6 review).
    expect(polar.calls).toEqual([cancel, cancel])
    expect(await planOf(userId)).toBeUndefined()
  })

  it("is deleted even when the second cancel fails", async () => {
    const { cookie, userId } = await accountWith(active)
    let deletes = 0
    polar.answer(({ method }) =>
      method !== "DELETE"
        ? undefined
        : ++deletes === 1
          ? new Response(null, { status: 204 })
          : Response.json({ detail: "down" }, { status: 503 })
    )

    const response = await deleteUser(cookie)

    expect(response.status).toBe(200)
    expect(deletes).toBe(2)
    expect(await planOf(userId)).toBeUndefined()
  })

  it("cancels billing even before Polar's webhook has come", async () => {
    // Paid a moment ago: Polar has the subscription, Parley doesn't know yet.
    const { cookie, userId } = await newAccount()

    const response = await deleteUser(cookie)

    expect(response.status).toBe(200)
    expect(polar.calls).toContainEqual({
      method: "DELETE",
      path: `/v1/customers/external/${userId}?anonymize=true`,
      body: undefined,
    })
  })

  it("keeps the account when Polar can't cancel the billing yet", async () => {
    const { cookie, userId } = await accountWith(active)
    polar.answer(() => Response.json({ detail: "down" }, { status: 503 }))

    const response = await deleteUser(cookie)

    expect(response.status).toBe(503)
    expect(await planOf(userId)).toBe("pro")
  })

  it("deletes a user Polar has no customer for", async () => {
    const { cookie, userId } = await newAccount()
    polar.answer(() =>
      Response.json(
        { error: "ResourceNotFound", detail: "Not found" },
        { status: 404 }
      )
    )

    const response = await deleteUser(cookie)

    expect(response.status).toBe(200)
    expect(await planOf(userId)).toBeUndefined()
  })

  it("is Free once Polar has canceled, even if the account then stays", async () => {
    const { userId } = await accountWith(active)

    await cancelBilling({ db: await database(), env, userId })

    expect(await planOf(userId)).toBe("free")
  })

  it("never calls Polar for a guest", async () => {
    const { cookie } = await signInGuest()

    await deleteUser(cookie)

    expect(polar.calls).toHaveLength(0)
  })
})
