import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth"
import { Polar } from "@polar-sh/sdk"
import type { WebhookCustomerStateChangedPayload } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload"
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound"
import { schema, setPlan, type Db, type Plan } from "@workspace/db"
import { APIError, getSessionFromCtx } from "better-auth/api"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { log, logInfo } from "./log"

// Parley Pro through Polar's SANDBOX (spec §4 Payments, T26), with Polar's
// Better Auth plugin: checkout, the customer portal and signed webhooks.
// https://polar.sh/docs/integrate/sdk/adapters/better-auth
//
// The plan lives on the user row (`plan`), so every session carries it.
// Only one webhook changes it: `customer.state_changed`, the whole customer
// state at a moment. It is applied only if it is newer than the one the
// plan came from, so a retry, a duplicate or a late delivery can't undo a
// newer state (setPlan).

export type BillingEnv = Pick<
  Env,
  "POLAR_ACCESS_TOKEN" | "POLAR_WEBHOOK_SECRET" | "POLAR_PRO_PRODUCT_ID"
>

/**
 * Polar's API. Sandbox only: the owner's rule for this project (no real
 * payments). Made per request, like the rest of the auth instance.
 */
function polarApi(env: BillingEnv) {
  return new Polar({ accessToken: env.POLAR_ACCESS_TOKEN, server: "sandbox" })
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
      // Only /customer/portal is open (see closedEndpoints). Its return URL
      // must be absolute, and Parley answers on several hosts (production,
      // Previews, localhost).
      portal({ returnUrl: origin && new URL(PRICING, origin).href }),
      webhooks({
        secret: env.POLAR_WEBHOOK_SECRET,
        onCustomerStateChanged: (payload) =>
          applyCustomerState(db, payload, env.POLAR_PRO_PRODUCT_ID),
      }),
    ],
  })
}

/**
 * Pro while the customer has a live subscription (active or in a trial) to
 * Parley Pro. A canceled subscription stays in the list until the paid
 * period ends; Polar then revokes it and sends a new state.
 */
export function planFromState(
  state: WebhookCustomerStateChangedPayload["data"],
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

/** Applies one `customer.state_changed` webhook to the user's plan. */
export async function applyCustomerState(
  db: Db,
  payload: WebhookCustomerStateChangedPayload,
  proProductId: string
) {
  const state = payload.data
  const fields = {
    customerId: state.id,
    eventAt: payload.timestamp.toISOString(),
  }
  // Every Parley checkout sets the external id; a customer made by hand in
  // Polar's dashboard has none, and there is nobody to give Pro to.
  if (!state.externalId) {
    log("warn", "polar_state", { ...fields, outcome: "no_external_id" })
    return
  }
  const plan = planFromState(state, proProductId)
  const result = await setPlan(db, {
    userId: state.externalId,
    plan,
    at: payload.timestamp,
  })
  // One line per state: "did this payment turn Pro on?" and "why is this
  // user still Pro?" are answered by userId.
  logInfo("polar_state", {
    ...fields,
    userId: state.externalId,
    plan,
    outcome: !result ? "no_user" : result.applied ? "applied" : "stale",
  })
}

/** What the checkout may ask for: Pro, and nothing else (no trials, no discounts, no other pages). */
const checkoutBody = z.strictObject({
  slug: z.literal("pro"),
  redirect: z.boolean().optional(),
})

type HookContext = Parameters<typeof getSessionFromCtx>[0]

/**
 * Before Polar's checkout: a signed-up user with a confirmed email (spec §2
 * Limits, the same rule as export and share), not Pro already, asking only
 * for Pro. The plugin itself would pass on trials, discounts, metadata and
 * return URLs from the request body. The user row is read fresh, not from
 * the 5-minute cookie cache: a user who just paid must not be sold Pro twice.
 */
export async function checkoutAllowed(ctx: HookContext) {
  const session = await getSessionFromCtx(ctx)
  if (!session || session.user.isAnonymous)
    throw APIError.from("UNAUTHORIZED", {
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    })
  if (!checkoutBody.safeParse(ctx.body).success)
    throw APIError.from("BAD_REQUEST", {
      code: "INVALID_CHECKOUT",
      message: "Only Parley Pro can be bought here.",
    })
  const user = await ctx.context.internalAdapter.findUserById(session.user.id)
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
}

/**
 * The plugin's other portal routes. Parley doesn't use them, and the
 * subscription list with a `referenceId` would list any customer's
 * subscriptions (it queries the whole organization), so they answer 404.
 */
export const closedEndpoints = new Set([
  "/customer/state",
  "/customer/benefits/list",
  "/customer/orders/list",
  "/customer/subscriptions/list",
])

/**
 * Before an account is deleted: a user who has had a Polar state (bought
 * Pro once) has a Polar customer, and deleting it cancels any subscription
 * at once and anonymizes it. If Polar can't do it now, the account stays
 * and the user can try again: a deleted user must never be charged.
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
    .select({ planUpdatedAt: schema.user.planUpdatedAt })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  if (!row?.planUpdatedAt) return
  try {
    await polarApi(env).customers.deleteExternal({
      externalId: userId,
      anonymize: true,
    })
    logInfo("polar_customer_deleted", { userId })
  } catch (error) {
    // Already gone: nothing is billed.
    if (error instanceof ResourceNotFound) return
    log("error", "polar_customer_delete_failed", { userId }, error)
    throw APIError.from("SERVICE_UNAVAILABLE", {
      code: "BILLING_NOT_CANCELED",
      message:
        "We couldn't cancel your Pro plan just now, so your account is still here. Please try again.",
    })
  }
}
