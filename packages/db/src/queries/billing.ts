import { and, eq, isNull, lte, or } from "drizzle-orm"

import { user } from "../auth-schema.ts"
import type { Plan } from "../billing-fields.ts"
import type { Db } from "../client.ts"

// The user's plan, as Polar's webhooks report it (spec §2 Limits, T26).

/**
 * Sets the plan from a Polar state made at `at`, unless the user already
 * has a newer one: Polar retries, and may deliver out of order. A state as
 * old as the stored one is applied again (the same state twice changes
 * nothing). One statement, so two deliveries at once can't interleave.
 *
 * The user's plan after it, and whether this state was applied; undefined
 * when there is no such user (deleted, or not a Parley user).
 */
export async function setPlan(
  db: Db,
  {
    userId,
    plan,
    at,
    customerId,
  }: {
    userId: string
    plan: Plan
    at: Date
    /**
     * Polar's id for the user as a customer: kept once they paid, so they
     * can reach past invoices. null forgets it (Polar deleted the customer);
     * undefined leaves it as it is.
     */
    customerId?: string | null
  }
) {
  const [updated] = await db
    .update(user)
    .set({ plan, planUpdatedAt: at, polarCustomerId: customerId })
    .where(
      and(
        eq(user.id, userId),
        // Through the column, so the date is written as UTC like the set.
        or(isNull(user.planUpdatedAt), lte(user.planUpdatedAt, at))
      )
    )
    .returning({ userId: user.id, plan: user.plan })
  if (updated) return { ...updated, applied: true }
  const [current] = await db
    .select({ userId: user.id, plan: user.plan })
    .from(user)
    .where(eq(user.id, userId))
  return current && { ...current, applied: false }
}

/**
 * The user's Polar customer id, kept since their first paid state; undefined
 * for someone who never paid (or whose customer Polar deleted).
 */
export async function polarCustomerOf(db: Db, userId: string) {
  const [row] = await db
    .select({ customerId: user.polarCustomerId })
    .from(user)
    .where(eq(user.id, userId))
  return row?.customerId ?? undefined
}

/** The user a Polar customer belongs to, from an earlier state. */
export async function userOfPolarCustomer(db: Db, customerId: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.polarCustomerId, customerId))
  return row?.id
}

/**
 * Forgets the user's Polar customer: Polar has none for them any more
 * (deleted by hand in its dashboard), so there is nothing to bill.
 */
export async function forgetPolarCustomer(db: Db, userId: string) {
  await db
    .update(user)
    .set({ polarCustomerId: null })
    .where(eq(user.id, userId))
}
