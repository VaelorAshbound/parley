import { checkout, polar, portal } from "@polar-sh/better-auth"
import { Polar } from "@polar-sh/sdk"
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate"
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound"
import {
  forgetPolarCustomer,
  polarCustomerOf,
  schema,
  setPlan,
  userOfPolarCustomer,
  type Db,
  type Plan,
} from "@workspace/db"
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { log, logInfo } from "./log"
import { verifyPolarWebhook } from "./polar-webhook"

// Parley Pro through Polar's SANDBOX (spec §4 Payments, T26), with Polar's
// Better Auth plugin for checkout and the customer portal, and our own
// route for its signed webhooks.
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
  | "STAGE"
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
  env,
  origin,
}: {
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
      // Not the plugin's webhooks(): its SDK can't check the signature of
      // an endpoint made after 2026-09-08 (polarWebhooks, below).
    ],
  })
}

/**
 * What Parley reads from a webhook: which customer's state changed. Polar
 * sends `external_id: null` for a customer without one; a missing field
 * means the same.
 */
const stateChanged = z.object({
  type: z.literal("customer.state_changed"),
  data: z.object({ id: z.string(), external_id: z.string().nullish() }),
})

/** The webhook's event type, when it has one. */
function typeOf(event: unknown) {
  const type: unknown =
    typeof event === "object" && event !== null && "type" in event
      ? event.type
      : undefined
  return typeof type === "string" ? type : undefined
}

/**
 * Polar's webhooks at /api/auth/polar/webhooks (the plugin's path). The
 * signature is checked with both of Polar's keys (server/polar-webhook.ts);
 * other events are acknowledged and ignored. Also the portal's answer when
 * Polar no longer has the customer (portalWithoutCustomer).
 */
export function polarWebhooks({ db, env }: { db: Db; env: BillingEnv }) {
  return {
    id: "parley-polar-webhooks",
    endpoints: {
      polarWebhooks: createAuthEndpoint(
        "/polar/webhooks",
        { method: "POST", metadata: { isAction: false }, cloneRequest: true },
        async (ctx) => {
          const body = (await ctx.request?.text()) ?? ""
          let event: unknown
          try {
            event = verifyPolarWebhook(
              body,
              Object.fromEntries(ctx.request?.headers ?? []),
              env.POLAR_WEBHOOK_SECRET
            )
          } catch {
            log("warn", "polar_webhook_refused", {})
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_SIGNATURE",
              message: "The webhook's signature doesn't match.",
            })
          }
          // Other events are acknowledged and ignored.
          if (typeOf(event) !== "customer.state_changed")
            return ctx.json({ received: true })
          const state = stateChanged.safeParse(event)
          if (!state.success) {
            // Signed by Polar, so acknowledged (sending it again wouldn't
            // read better), but seen: a plan that never changes must leave
            // a trace. Field paths only: the payload holds the customer's
            // email and name.
            log("warn", "polar_webhook_unreadable", {
              type: "customer.state_changed",
              webhookId: ctx.request?.headers.get("webhook-id") ?? undefined,
              issues: state.error.issues
                .map((issue) => issue.path.join("."))
                .join(","),
            })
            return ctx.json({ received: true })
          }
          // A throw answers 500, and Polar sends it again later.
          await applyCustomerState(db, env, {
            customerId: state.data.data.id,
            externalId: state.data.data.external_id ?? null,
          })
          return ctx.json({ received: true })
        }
      ),
    },
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === "/customer/portal",
          handler: createAuthMiddleware(portalWithoutCustomer({ db, env })),
        },
      ],
    },
    init: () => ({ options: { databaseHooks: emailToPolar({ db, env }) } }),
  } satisfies BetterAuthPlugin
}

/**
 * Better Auth's hook on a changed email (the user row's update, as
 * server/audit.ts sees it): a Polar customer gets the new address too, so
 * receipts and the portal's sign-in go where Parley's do. After the
 * response, like the emails: a slow Polar never holds up the link. A
 * failure is logged and the email stays changed; the next checkout sends
 * the email again anyway (makeCustomer).
 */
function emailToPolar({ db, env }: { db: Db; env: BillingEnv }) {
  // The before hook sees which fields change; the after hook gets the same
  // endpoint context and the saved row.
  const changingEmail = new WeakSet<object>()
  return {
    user: {
      update: {
        before: async (data, ctx) => {
          if (ctx && typeof data.email === "string") changingEmail.add(ctx)
        },
        after: async (user, ctx) => {
          if (!ctx || !changingEmail.has(ctx)) return
          await ctx.context.runInBackgroundOrAwait(
            syncEmail({ db, env }, { userId: user.id, email: user.email })
          )
        },
      },
    },
  } satisfies NonNullable<BetterAuthOptions["databaseHooks"]>
}

/** Sends the user's email to their Polar customer, if Polar has one. */
async function syncEmail(
  { db, env }: { db: Db; env: BillingEnv },
  user: { userId: string; email: string }
) {
  // Never bought: Polar learns the email at checkout.
  if ((await polarCustomerOf(db, user.userId)) === undefined) return
  await sendEmailToPolar(env, user)
}

/**
 * Gives the user's Polar customer (by our user id) this email. Logs, never
 * throws: the change in Parley stands either way.
 */
export async function sendEmailToPolar(
  env: BillingEnv,
  { userId, email }: { userId: string; email: string }
) {
  try {
    await polarApi(env).customers.updateExternal({
      externalId: userId,
      customerUpdateExternalID: { email },
    })
    logInfo("polar_email_synced", { userId })
  } catch (error) {
    // 404: deleted in Polar. 422: another customer has this email
    // (PAR-17). Neither stops the change in Parley.
    log("warn", "polar_email_not_synced", { userId, ...statusOf(error) }, error)
  }
}

/**
 * After the portal failed (the plugin answers 500 for any of Polar's
 * errors): when Polar has no customer for the user any more (deleted by
 * hand in its dashboard; the portal session then answers 422), say there
 * is no billing, as for someone who never bought, and forget the customer,
 * so the account menu stops offering Billing. One more call to Polar, on
 * failures only.
 */
function portalWithoutCustomer({ db, env }: { db: Db; env: BillingEnv }) {
  return async (ctx: HookContext) => {
    // What the endpoint answered: set on after hooks' context, which
    // createAuthMiddleware's type leaves out.
    const { returned } = ctx.context as { returned?: unknown }
    if (!isAPIError(returned) || returned.statusCode !== 500) return
    const session = await getSessionFromCtx(ctx)
    if (!session) return
    const answer = await portalWithoutCustomerAnswer(env, session.user.id)
    if (answer) await forgetPolarCustomer(db, session.user.id)
    return answer
  }
}

/**
 * NO_BILLING (404) when Polar has no customer for this user; undefined
 * when it has one, or can't say (the portal's 500 stands).
 */
export async function portalWithoutCustomerAnswer(
  env: BillingEnv,
  userId: string
) {
  try {
    await polarApi(env).customers.getExternal({ externalId: userId })
    return undefined
  } catch (error) {
    if (!(error instanceof ResourceNotFound)) return undefined
  }
  log("warn", "polar_portal_no_customer", { userId })
  // A Response, not a throw: Better Auth keeps the handler's 500 status
  // for an APIError thrown in an after hook (better-auth 1.7.5,
  // api/dispatch.mjs), and only a Response's own status survives.
  return Response.json(noBilling, { status: 404 })
}

/** Someone Polar has no customer for. */
const noBilling = {
  code: "NO_BILLING",
  message: "There is no billing yet. Upgrade to Pro first.",
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

/**
 * Whether this stage (production, or the Previews) sold the customer's Pro:
 * checkout stamps its stage in the metadata, and Polar copies it to the
 * subscription.
 */
function soldHere(state: CustomerState, env: BillingEnv) {
  return state.activeSubscriptions.some(
    (subscription) =>
      subscription.productId === env.POLAR_PRO_PRODUCT_ID &&
      subscription.metadata["stage"] === env.STAGE
  )
}

/**
 * What the user row keeps of the customer (setPlan): its id once it paid,
 * so a Free user who paid before still reaches past invoices (the account
 * menu's Billing); nothing once Polar deleted it. Not before a payment:
 * checkout makes the customer, and Polar reports it, before anyone pays.
 */
function customerToKeep(
  state: CustomerState | undefined,
  plan: Plan,
  customerId: string
) {
  if (!state || state.deletedAt) return null
  return plan === "pro" ? customerId : undefined
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
  {
    customerId,
    externalId,
  }: {
    customerId: string
    /** Our user id, as Polar knows it; cleared when Polar deletes it. */
    externalId: string | null
  }
) {
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
    const result = await setPlan(db, {
      userId,
      plan,
      at,
      customerId: customerToKeep(state, plan, customerId),
    })
    if (!result && state && plan === "pro" && soldHere(state, env)) {
      // Paid for an account that is gone (checkout finished in another tab
      // after it was deleted): cancel, so nobody is charged for it. Only
      // what this stage sold: Previews and production share one Polar
      // organization and each gets every webhook, so an unknown user may be
      // another stage's paying customer (Checkpoint 6 review).
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
  if ("plan" in user && user.plan === "pro")
    throw APIError.from("CONFLICT", {
      code: "ALREADY_PRO",
      message: "You already have Pro.",
    })
  await makeCustomer(env, user)
  return {
    context: {
      body: {
        ...body.data,
        allowDiscountCodes: false,
        // Copied to the subscription: which stage sold it (soldHere).
        metadata: { stage: env.STAGE },
      },
    },
  }
}

/**
 * Makes the Polar customer with the confirmed email and name, so checkout
 * fills them in and the buyer is who Parley knows (the plugin sends only
 * our user id). Polar already having the customer (a second try), or the
 * email (PAR-17), is fine: checkout then asks for the email, as it would.
 */
async function makeCustomer(
  env: BillingEnv,
  user: { id: string; email: string; name: string }
) {
  try {
    await polarApi(env).customers.create({
      externalId: user.id,
      email: user.email,
      name: user.name,
    })
  } catch (error) {
    // 422 (this external id) and 409 (this email) mean Polar has the
    // customer: every second checkout. Only another answer is news.
    const { polarStatus } = statusOf(error)
    if (polarStatus === 409 || polarStatus === 422) return
    log(
      "warn",
      "polar_customer_not_made",
      { userId: user.id, polarStatus },
      error
    )
  }
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
  if ((await polarCustomerOf(db, account.id)) === undefined)
    throw APIError.from("NOT_FOUND", noBilling)
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
    if (await deleteCustomer(env, userId))
      logInfo("polar_customer_deleted", { userId })
  } catch (error) {
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
  // Nothing is billed now, even if deleting the account then fails.
  await setPlan(db, { userId, plan: "free", at })
}

/**
 * After the account is deleted: asks Polar once more. A checkout that
 * finished in another tab during the delete made a new customer, and its
 * webhook may have come while the user row was still there, so nothing
 * canceled it (Checkpoint 6 review). The account is gone either way, so a
 * failure is only logged.
 */
export async function cancelBillingAgain(
  env: BillingEnv,
  user: { id: string; isAnonymous?: boolean | null | undefined }
) {
  if (user.isAnonymous) return
  try {
    await deleteCustomer(env, user.id)
  } catch (error) {
    log(
      "error",
      "polar_customer_delete_failed",
      { userId: user.id, after: true, ...statusOf(error) },
      error
    )
  }
}

/**
 * Deletes the user's Polar customer, which cancels any subscription at
 * once and anonymizes it. False when Polar has no such customer.
 */
async function deleteCustomer(env: BillingEnv, userId: string) {
  try {
    await polarApi(env).customers.deleteExternal({
      externalId: userId,
      anonymize: true,
    })
    return true
  } catch (error) {
    if (error instanceof ResourceNotFound) return false
    throw error
  }
}
