import { eq, inArray } from "drizzle-orm"
import { describe, expect } from "vite-plus/test"

import { session, twoFactor, user } from "../src/auth-schema.ts"
import type { Db } from "../src/client.ts"
import {
  claimUnconfirmedAccount,
  listSessions,
  sessionToken,
} from "../src/queries/accounts.ts"
import { makeUser, test } from "./db.ts"

let sessions = 0

/** A session row, as Better Auth would make it. */
async function makeSession(
  db: Db,
  userId: string,
  fields: { expiresAt?: Date; updatedAt?: Date; userAgent?: string } = {}
) {
  sessions += 1
  const [row] = await db
    .insert(session)
    .values({
      id: `session-${sessions}`,
      token: `token-${sessions}`,
      userId,
      expiresAt: new Date(Date.now() + 86_400_000),
      updatedAt: new Date(),
      ...fields,
    })
    .returning()
  if (!row) throw new Error("No session row")
  return row
}

describe("claimUnconfirmedAccount", () => {
  test("confirms the email", async ({ db }) => {
    const ana = await makeUser(db)

    await claimUnconfirmedAccount(db, ana.id)

    const [row] = await db.select().from(user).where(eq(user.id, ana.id))
    expect(row?.emailVerified).toBe(true)
  })

  test("turns off two-factor sign-in someone else may have set up", async ({
    db,
  }) => {
    const ana = await makeUser(db)
    const bo = await makeUser(db)
    for (const each of [ana, bo]) {
      await db
        .update(user)
        .set({ twoFactorEnabled: true })
        .where(eq(user.id, each.id))
      await db.insert(twoFactor).values({
        id: `two-factor-${each.id}`,
        userId: each.id,
        secret: "encrypted",
        backupCodes: "encrypted",
      })
    }

    await claimUnconfirmedAccount(db, ana.id)

    const users = await db
      .select({ id: user.id, twoFactorEnabled: user.twoFactorEnabled })
      .from(user)
      .where(inArray(user.id, [ana.id, bo.id]))
    expect(users).toEqual(
      expect.arrayContaining([
        { id: ana.id, twoFactorEnabled: false },
        { id: bo.id, twoFactorEnabled: true },
      ])
    )
    const secrets = await db
      .select({ userId: twoFactor.userId })
      .from(twoFactor)
      .where(inArray(twoFactor.userId, [ana.id, bo.id]))
    expect(secrets).toEqual([{ userId: bo.id }])
  })
})

describe("listSessions", () => {
  test("lists the user's live sessions, most recently used first, without tokens", async ({
    db,
  }) => {
    const ana = await makeUser(db)
    const bo = await makeUser(db)
    const older = await makeSession(db, ana.id, {
      updatedAt: new Date("2026-09-01T10:00:00Z"),
      userAgent: "Firefox",
    })
    const newer = await makeSession(db, ana.id, {
      updatedAt: new Date("2026-09-20T10:00:00Z"),
    })
    await makeSession(db, ana.id, { expiresAt: new Date(Date.now() - 1000) })
    await makeSession(db, bo.id)

    const listed = await listSessions(db, { userId: ana.id })

    expect(listed.map((each) => each.id)).toEqual([newer.id, older.id])
    expect(listed[1]).toEqual({
      id: older.id,
      createdAt: older.createdAt,
      updatedAt: older.updatedAt,
      userAgent: "Firefox",
    })
  })
})

describe("sessionToken", () => {
  test("finds the token of the user's own session", async ({ db }) => {
    const ana = await makeUser(db)
    const mine = await makeSession(db, ana.id)

    expect(await sessionToken(db, { id: mine.id, userId: ana.id })).toBe(
      mine.token
    )
  })

  test("finds nothing for someone else's session", async ({ db }) => {
    const ana = await makeUser(db)
    const bo = await makeUser(db)
    const theirs = await makeSession(db, bo.id)

    expect(
      await sessionToken(db, { id: theirs.id, userId: ana.id })
    ).toBeUndefined()
  })
})
