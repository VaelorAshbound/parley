# ADR-0008: Parley Pro through Polar: the plan on the user row, read from Polar's current state

## Status

Accepted (built in T26, 2026-09-27)

## Context

Spec §2 Limits and §4 Payments: Parley Pro ($5 a month) gives unlimited documents, Word files and the Pro AI budget. It is sold through Polar's **sandbox** (no real payments, the owner's rule) with `@polar-sh/better-auth`: checkout, the customer portal and signed webhooks at `/api/auth/polar/webhooks`.

This is a money path. The ways to get it wrong, most of them found by an adversarial review of the first version:

1. **Webhooks arrive twice, late, or out of order.** Ordering them by the payload's `timestamp` trusts an undocumented Polar detail, and two changes in the same millisecond tie.
2. **Charging a deleted user.** The subscription exists as soon as checkout is confirmed; the webhook comes later. Deleting an account in that gap, or finishing a checkout in one tab after deleting the account in another, leaves a subscription nobody can cancel.
3. **A customer deleted in Polar loses its external id** (our user id), so its last state can't name the user, who would stay Pro.
4. **Selling Pro twice** (two checkout tabs, or a second click before the webhook).
5. **Letting the client shape the checkout.** The plugin passes on trials, discounts, metadata, return URLs and discount codes from the request body.
6. **Exhausting Polar's API limit**, which is the whole organization's, from one account.

## Decision

- **The plan is a Better Auth additional field on the user row** (`plan`, `input: false`), so every session carries it and reading it costs no query. `planUpdatedAt` and `polarCustomerId` sit beside it, never returned to the client. Migration `0004_user_plan`.
- **Only `customer.state_changed` changes the plan, and only as a sign.** The handler reads the customer's current state from Polar (`customers.getState`) and sets the plan from that (Polar's own advice), stamped with the time just before the read; `setPlan` keeps a newer stamp. So order, duplicates and ties don't matter (1). A customer Polar no longer has is Free. A failed read fails the webhook, and Polar sends it again.
- **The user is found by the external id, else by the stored customer id** (3). A customer with neither (made by hand in Polar's dashboard) is left alone and logged.
- **A paid state for an account that is gone cancels the subscription** (`customers.delete`, anonymized) (2).
- **Deleting an account always asks Polar to delete the customer first**, for every non-guest user, not only after a webhook (2). "No such customer" is fine; any other failure keeps the account ("please try again"). Once Polar confirms, the plan is set to Free, even if the delete then fails.
- **Checkout is guarded before the plugin runs** (Better Auth before-hook): a signed-up user with a confirmed email, not Pro (read fresh, not from the 5-minute cookie cache), and a body that is exactly `{ slug: "pro", redirect? }`. The hook answers the body the checkout runs with, adding `allowDiscountCodes: false` (5). **Polar's organization refuses a second subscription** (`allow_multiple_subscriptions: false`, checked through the API on 2026-09-27), which covers the gap before the webhook (4).
- **The portal is POST only**, and only for users Polar has a customer for (`NO_BILLING` otherwise): a GET passes Better Auth's origin check, and a link on another site sends the cookie with it.
- **Checkout and the portal are limited per user**, 5 a minute, on a Cloudflare Rate Limiting binding (`BILLING_RATE_LIMITER`), not Better Auth's per-IP limiter (6). The webhook route has no IP limit: it is signed, and turning Polar's bursts away would make it give up on the endpoint.
- **The plugin's other routes are closed** with Better Auth's `disabledPaths` (404): the subscription list with a `referenceId` would query the whole organization.
- **Customers are made at checkout**, not at sign-up: most users never buy, and sign-up shouldn't wait for, or fail with, Polar.

## Alternatives Considered

### Order webhooks by the payload's `timestamp`

- Pros: No API call per webhook.
- Cons: Polar doesn't document how the timestamp is set; JavaScript dates drop its microseconds, so close changes tie, and the last to arrive wins.
- Rejected: one extra read per webhook (a handful a month per customer) buys correctness.

### A subscriptions table fed by every `subscription.*` event

- Pros: The full history in our database.
- Cons: More events to order and reconcile, and the plan is still derived from them.
- Rejected: `customer.state_changed` plus a read of the current state is the whole truth in one place.

### Read the plan from Polar on each request

- Pros: Never stale.
- Cons: A Polar call on every export and chat turn; Polar down means Parley down.
- Rejected: the row is read with the session for free.

### Cancel billing on delete only after a webhook set `planUpdatedAt`

- Pros: No Polar call for users who never bought.
- Cons: Misses the gap between payment and webhook (2).
- Rejected: one API call per account deletion is cheap.

## Consequences

- A browser's session cookie cache can say Free for up to 5 minutes after paying. `/pricing` asks for a fresh session after checkout (Better Auth refreshes the cookie), so the browser that paid sees Pro at once; other devices catch up within 5 minutes, like a sign-out does today.
- Each webhook costs one Polar API call; each account deletion costs one.
- Replays inside Standard Webhooks' 5-minute window are accepted, and harmless: the handler reads the current state.
- `plan` is a `text` column without a CHECK constraint (Better Auth generates the schema). `planOf` reads anything but `"pro"` as Free, the safe side.
- Previews and production share the one sandbox organization and product. A buyer who first bought on a Preview may already be a Polar customer with that email; how Polar attaches a second external id is untested (PAR-17).
