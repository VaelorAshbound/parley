import { and, desc, eq, gt, like } from "drizzle-orm"

import { session, twoFactor, user, verification } from "../auth-schema.ts"
import type { Db } from "../client.ts"

// Account settings (T23). Better Auth owns these tables; these reads and the
// one write cover what its own API doesn't.

/**
 * The owner of the inbox takes an account whose email was never confirmed:
 * they opened a password reset link sent there. Their email now counts as
 * confirmed. Whoever made the account may have been someone else using
 * this address (spec §5 Auth), so two-factor sign-in goes too: its secret
 * is theirs, and the owner could never sign in past it. So do the devices
 * they trusted to skip the code.
 */
export async function claimUnconfirmedAccount(db: Db, userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId))
    await forgetTrustedDevices(tx, userId)
    await tx
      .update(user)
      .set({ emailVerified: true, twoFactorEnabled: false })
      .where(eq(user.id, userId))
  })
}

/**
 * Forgets every device the user trusted to skip the two-factor code ("Trust
 * this device for 30 days", T23b). Better Auth's twoFactor plugin keeps each
 * as a verification row named `trust-device-…` whose value is the user's id,
 * and on turning two-factor off forgets only the device that asked.
 */
export async function forgetTrustedDevices(db: Db, userId: string) {
  await db
    .delete(verification)
    .where(
      and(
        eq(verification.value, userId),
        like(verification.identifier, "trust-device-%")
      )
    )
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
