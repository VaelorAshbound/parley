import { and, desc, eq, gt } from "drizzle-orm"

import { session, user } from "../auth-schema.ts"
import type { Db } from "../client.ts"

// Account settings (T23). Better Auth owns these tables; these reads and the
// one write cover what its own API doesn't.

/**
 * The user proved they own their inbox (they opened a password reset link
 * sent there), so their email counts as confirmed.
 */
export async function confirmEmail(db: Db, userId: string) {
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))
}

/**
 * The user's signed-in devices, most recently used first. Never the tokens:
 * a token is the session, and the page only needs to name the device.
 */
export async function listSessions(db: Db, { userId }: { userId: string }) {
  return db
    .select({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt))
}

/** The token of one of the user's own sessions, to revoke it. */
export async function sessionToken(
  db: Db,
  { id, userId }: { id: string; userId: string }
) {
  const [row] = await db
    .select({ token: session.token })
    .from(session)
    .where(and(eq(session.id, id), eq(session.userId, userId)))
  return row?.token
}
