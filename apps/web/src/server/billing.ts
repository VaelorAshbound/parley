import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth"
import { Polar } from "@polar-sh/sdk"
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate"
import type { WebhookCustomerStateChangedPayload } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload"
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound"
import {
  schema,
  setPlan,
  userOfPolarCustomer,
  type Db,
  type Plan,
} from "@workspace/db"
import { APIError, getSessionFromCtx } from "better-auth/api"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { log, logInfo } from "./log"

// Parley Pro through Polar's SANDBOX (spec §4 Payments, T26), with Polar's
// Better Auth plugin: checkout, the customer portal and signed webhooks.
// https://polar.sh/docs/integrate/sdk/adapters/better-auth
//
// The plan lives on the user row (`plan`), so every session carries it.
// Only one webhook changes it, `customer.state_changed`, and only as a sign
// that something changed: the plan comes from the customer's state read
// from Polar's API then (Polar's advice), so a retry, a duplicate or a late
// delivery can't undo a newer state.

export type BillingEnv = Pick<
  Env,
  | "POLAR_ACCESS_TOKEN"
  | "POLAR_WEBHOOK_SECRET"
  | "POLAR_PRO_PRODUCT_ID"
  | "BILLING_RATE_LIMITER"
>

/**
 * Polar's API. Sandbox only: the owner's rule for this project (no real
 * payments). Made per request, like the rest of the auth instance. A slow
 * Polar fails after 10 s instead of holding the request.
 */
function polarApi(env: BillingEnv) {
  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: "sandbox",
    timeoutMs: 10_000,
  })
}

/** The page checkout and the portal come back to. */
const PRICING = "/pricing"

/**
 * The Better Auth plugin. Customers are made at checkout (by our user id),
 * not at sign-up: most users never buy, and sign-up shouldn't wait for, or
 * fail with, Polar.
 */
export function billingPlugin({
  db,
  env,
  origin,
}: {
  db: Db
  env: BillingEnv
  /** This request's origin: the portal's "back to Parley" link. */
  origin?: string | undefined
}) {
  return polar({
    client: polarApi(env),
    createCustomerOnSignUp: false,
    use: [
      checkout({
        products: [{ productId: env.POLAR_PRO_PRODUCT_ID, slug: "pro" }],
        // Polar fills in {CHECKOUT_ID}; the page waits for the webhook.
        successUrl: `${PRICING}?checkout_id={CHECKOUT_ID}`,
        returnUrl: PRICING,
        authenticatedUsersOnly: true,
      }),
      // Only /customer/portal is open (closedPaths). Its return URL must be
      // absolute, and Parley answers on several hosts (production, Previews,
      // localhost).
      portal({ returnUrl: origin && new URL(PRICING, origin).href }),
      webhooks({
        secret: env.POLAR_WEBHOOK_SECRET,
        onCustomerStateChanged: (payload) =>
          applyCustomerState(db, env, payload),
      }),
    ],
  })
}

/**
 * The plugin's routes Parley doesn't use, closed with Better Auth's
 * `disabledPaths` (404). The subscription list with a `referenceId` would
 * list any customer's subscriptions (it queries the whole organization).
 */
export const closedPaths = [
  "/customer/state",
  "/customer/benefits/list",
  "/customer/orders/list",
  "/customer/subscriptions/list",
]

/**
 * Pro while the customer has a live subscription (active or in a trial) to
 * Parley Pro. A canceled subscription stays in the list until the paid
 * period ends; Polar then revokes it and sends a new state.
 */
export function planFromState(
  state: CustomerState,
  proProductId: string
): Plan {
  if (state.deletedAt) return "free"
  const pro = state.activeSubscriptions.some(
    (subscription) =>
      subscription.productId === proProductId &&
      (subscription.status === "active" || subscription.status === "trialing")
  )
  return pro ? "pro" : "free"
}

/** The customer's state now, or undefined when Polar has no such customer. */
async function currentState(env: BillingEnv, customerId: string) {
  try {
    return await polarApi(env).customers.getState({ id: customerId })
  } catch (error) {
    if (error instanceof ResourceNotFound) return undefined
    throw error
  }
}

/**
 * Applies one `customer.state_changed` webhook: reads the customer's state
 * now and sets the user's plan from it. A throw makes the webhook fail, and
 * Polar sends it again later.
 */
export async function applyCustomerState(
  db: Db,
  env: BillingEnv,
  payload: WebhookCustomerStateChangedPayload
) {
  const { id: customerId, externalId } = payload.data
  // Deleting a customer in Polar clears its external id (our user id); the
  // customer id we kept still finds the user.
  const userId = externalId ?? (await userOfPolarCustomer(db, customerId))
  if (!userId) {
    // Made by hand in Polar's dashboard: nobody to give Pro to.
    log("warn", "polar_state", { customerId, outcome: "no_user" })
    return
  }
  const fields = { customerId, userId }
  try {
    // Before the read: a state read later wins over this one.
    const at = new Date()
    const state = await currentState(env, customerId)
    const plan = state ? planFromState(state, env.POLAR_PRO_PRODUCT_ID) : "free"
    const result = await setPlan(db, { userId, plan, at, customerId })
    if (!result && plan === "pro") {
      // Paid for an account that is gone (checkout finished in another tab
      // after it was deleted): cancel, so nobody is charged for it.
      await polarApi(env).customers.delete({ id: customerId, anonymize: true })
      log("warn", "polar_state", { ...fields, plan, outcome: "canceled" })
      return
    }
    // One line per state: "did this payment turn Pro on?" and "why is this
    // user still Pro?" are answered by userId.
    logInfo("polar_state", {
      ...fields,
      plan,
      outcome: !result ? "no_user" : result.applied ? "applied" : "stale",
    })
  } catch (error) {
    log("error", "polar_state_failed", { ...fields, ...statusOf(error) }, error)
    throw error
  }
}

/** Polar's HTTP status, when it answered: 401 (token) is not 503 (outage). */
function statusOf(error: unknown) {
  const status = (error as { statusCode?: unknown }).statusCode
  return typeof status === "number" ? { polarStatus: status } : {}
}

type HookContext = Parameters<typeof getSessionFromCtx>[0]

/** A signed-up user's session, or 401. */
async function accountOf(ctx: HookContext) {
  const session = await getSessionFromCtx(ctx)
  if (!session || session.user.isAnonymous)
    throw APIError.from("UNAUTHORIZED", {
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    })
  return session.user
}

/**
 * Each checkout or portal visit is a call to Polar's API, whose limit is
 * the whole organization's: at most 5 a minute per user, on any network.
 */
async function withinLimit(env: BillingEnv, userId: string) {
  const { success } = await env.BILLING_RATE_LIMITER.limit({ key: userId })
  if (!success)
    throw APIError.from("TOO_MANY_REQUESTS", {
      code: "TOO_MANY_REQUESTS",
      message: "Too many tries. Please wait a minute.",
    })
}

/** What the checkout may ask for: Pro, and nothing else (no trials, no discounts, no other pages). */
const checkoutBody = z.strictObject({
  slug: z.literal("pro"),
  redirect: z.boolean().optional(),
})

/**
 * Before Polar's checkout: a signed-up user with a confirmed email (spec §2
 * Limits, the same rule as export and share), not Pro already, asking only
 * for Pro. The plugin itself would pass on trials, discounts, metadata and
 * return URLs from the request body. The user row is read fresh, not from
 * the 5-minute cookie cache: a user who just paid must not be sold Pro twice
 * (and Polar's organization refuses a second subscription, ADR-0008).
 *
 * Answers the body the checkout runs with: Parley has no discount codes, so
 * Polar's page shows no field for one.
 */
export async function checkoutAllowed(ctx: HookContext, env: BillingEnv) {
  const account = await accountOf(ctx)
  const body = checkoutBody.safeParse(ctx.body)
  if (!body.success)
    throw APIError.from("BAD_REQUEST", {
      code: "INVALID_CHECKOUT",
      message: "Only Parley Pro can be bought here.",
    })
  await withinLimit(env, account.id)
  const user = await ctx.context.internalAdapter.findUserById(account.id)
  if (!user?.emailVerified)
    throw APIError.from("FORBIDDEN", {
      code: "EMAIL_NOT_VERIFIED",
      message: "Please confirm your email first. We sent you a link.",
    })
  if ((user as { plan?: unknown }).plan === "pro")
    throw APIError.from("CONFLICT", {
      code: "ALREADY_PRO",
      message: "You already have Pro.",
    })
  return { context: { body: { ...body.data, allowDiscountCodes: false } } }
}

/**
 * Before Polar's portal: by POST only (a GET passes the origin check, and a
 * link on another site sends the cookie with it), and only for someone
 * Polar has a customer for.
 */
export async function portalAllowed(ctx: HookContext, env: BillingEnv, db: Db) {
  if (ctx.request?.method !== "POST")
    throw APIError.from("METHOD_NOT_ALLOWED", {
      code: "METHOD_NOT_ALLOWED",
      message: "Open billing from Parley.",
    })
  const account = await accountOf(ctx)
  await withinLimit(env, account.id)
  const [row] = await db
    .select({ customerId: schema.user.polarCustomerId })
    .from(schema.user)
    .where(eq(schema.user.id, account.id))
  if (!row?.customerId)
    throw APIError.from("NOT_FOUND", {
      code: "NO_BILLING",
      message: "There is no billing yet. Upgrade to Pro first.",
    })
}

/**
 * Before an account is deleted: asks Polar to delete the user's customer,
 * which cancels any subscription at once and anonymizes it. Always, not
 * only after a webhook: one may still be on its way for a checkout that
 * just finished. "No such customer" is fine. If Polar can't do it now, the
 * account stays and the user can try again: a deleted user must never be
 * charged. Guests never bought.
 */
export async function cancelBilling({
  db,
  env,
  userId,
}: {
  db: Db
  env: BillingEnv
  userId: string
}) {
  const [row] = await db
    .select({ isAnonymous: schema.user.isAnonymous })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  if (!row || row.isAnonymous) return
  const at = new Date()
  try {
    await polarApi(env).customers.deleteExternal({
      externalId: userId,
      anonymize: true,
    })
    logInfo("polar_customer_deleted", { userId })
  } catch (error) {
    if (!(error instanceof ResourceNotFound)) {
      log(
        "error",
        "polar_customer_delete_failed",
        { userId, ...statusOf(error) },
        error
      )
      throw APIError.from("SERVICE_UNAVAILABLE", {
        code: "BILLING_NOT_CANCELED",
        message:
          "We couldn't cancel your Pro plan just now, so your account is still here. Please try again.",
      })
    }
  }
  // Nothing is billed now, even if deleting the account then fails.
  await setPlan(db, { userId, plan: "free", at })
}
