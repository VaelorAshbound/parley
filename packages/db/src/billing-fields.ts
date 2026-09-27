// The user's plan, kept on Better Auth's user row (spec §2 Limits, T26), so
// every session already carries it and reading it costs no query. Polar's
// webhooks set it (apps/web/src/server/billing.ts); nobody else can
// (`input: false`: Better Auth refuses it in sign-up and update-user).
// Shared by the app's auth config and the schema CLI config
// (scripts/auth-schema.config.ts), so the two can't drift apart.

import type { DBFieldAttribute } from "better-auth/db"

export const PLANS = ["free", "pro"] as const
export type Plan = (typeof PLANS)[number]

export const billingFields = {
  plan: {
    type: ["free", "pro"],
    required: true,
    defaultValue: "free",
    input: false,
  },
  /**
   * When Polar sent the customer state that set `plan`. A state older than
   * this is ignored, so a late or repeated webhook can't undo a newer one.
   */
  planUpdatedAt: {
    type: "date",
    required: false,
    input: false,
    returned: false,
  },
  /**
   * Polar's id for this user as a customer, from its webhooks. A customer
   * deleted in Polar loses its external id (our user id); this still finds
   * the user, so the plan can go back to Free.
   */
  polarCustomerId: {
    type: "string",
    required: false,
    unique: true,
    input: false,
    returned: false,
  },
} satisfies Record<string, DBFieldAttribute>
