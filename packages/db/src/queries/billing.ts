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
  { userId, plan, at }: { userId: string; plan: Plan; at: Date }
) {
  const [updated] = await db
    .update(user)
    .set({ plan, planUpdatedAt: at })
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
