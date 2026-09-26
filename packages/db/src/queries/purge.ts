import { and, eq, gte, inArray, lt, notExists, or, sql } from "drizzle-orm"

import { session, user } from "../auth-schema.ts"
import type { Db } from "../client.ts"
import { aiUsage, draft } from "../schema.ts"

// The nightly cleanup (spec §2 Limits, T28). Deletes are for good, so each
// statement deletes a bounded batch, returns only a row count (no rows cross
// the wire: Neon bills egress), and runs on its own, so its locks are short.

/**
 * Deletes up to `limit` guests with no activity since `inactiveSince`, and
 * everything they own: drafts, chats, AI usage, sessions (the foreign keys
 * cascade). Returns how many went.
 *
 * Only guests (`is_anonymous` true): never an account. A guest counts as
 * active if any of these is newer than the cutoff: made or changed, a
 * session used (Better Auth refreshes it daily while in use), a draft or its
 * chat changed, or AI usage that day. A session that is still valid also
 * keeps them: its cookie can come back at any time.
 *
 * A guest signing in right now is skipped: moveGuestData holds their row
 * (FOR UPDATE) while it moves their drafts, and SKIP LOCKED passes over it
 * instead of waiting. Better Auth deletes that guest itself once linked.
 */
export async function deleteIdleGuests(
  db: Db,
  {
    now,
    inactiveSince,
    limit,
  }: { now: Date; inactiveSince: Date; limit: number }
): Promise<number> {
  // AI usage is kept per UTC day; any of the cutoff's day may be after it.
  const sinceDay = inactiveSince.toISOString().slice(0, 10)
  const idle = db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.isAnonymous, true),
        lt(user.createdAt, inactiveSince),
        lt(user.updatedAt, inactiveSince),
        notExists(
          db
            .select({ one: sql`1` })
            .from(session)
            .where(
              and(
                eq(session.userId, user.id),
                or(
                  // Still valid: Better Auth ends a session once expiresAt < now.
                  gte(session.expiresAt, now),
                  gte(session.updatedAt, inactiveSince)
                )
              )
            )
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(draft)
            .where(
              and(
                eq(draft.userId, user.id),
                gte(draft.updatedAt, inactiveSince)
              )
            )
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(aiUsage)
            .where(and(eq(aiUsage.userId, user.id), gte(aiUsage.day, sinceDay)))
        )
      )
    )
    .limit(limit)
    .for("update", { skipLocked: true })

  const result = await db.delete(user).where(inArray(user.id, idle))
  return result.rowCount ?? 0
}

/**
 * Deletes up to `limit` sessions that ran out before `now`, any user's.
 * Better Auth refuses them already; this only stops the table growing.
 */
export async function deleteExpiredSessions(
  db: Db,
  { now, limit }: { now: Date; limit: number }
): Promise<number> {
  const expired = db
    .select({ id: session.id })
    .from(session)
    .where(lt(session.expiresAt, now))
    .limit(limit)
    .for("update", { skipLocked: true })

  const result = await db.delete(session).where(inArray(session.id, expired))
  return result.rowCount ?? 0
}
