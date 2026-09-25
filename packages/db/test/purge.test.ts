import { eq, inArray } from "drizzle-orm"
import { describe, expect, inject } from "vite-plus/test"

import { session, user } from "../src/auth-schema.ts"
import { connect, type Db } from "../src/client.ts"
import { createDraft } from "../src/queries/drafts.ts"
import { moveGuestData } from "../src/queries/guests.ts"
import { saveMessages } from "../src/queries/messages.ts"
import {
  deleteExpiredSessions,
  deleteIdleGuests,
} from "../src/queries/purge.ts"
import { aiUsage, draft, message } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

// The purge deletes for good, so every rule has a test that fails if it
// deletes one row too many (T28).

const DAY = 86_400_000
/** The cron's clock: fixed, never the real one. */
const now = new Date("2026-03-20T03:17:00.000Z")
/** Guests with no activity since this are deleted. */
const inactiveSince = new Date(now.getTime() - 7 * DAY)
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY)
const purge = (db: Db, limit = 100) =>
  deleteIdleGuests(db, { now, inactiveSince, limit })

const nda = { documentId: "mutual-nda", title: "NDA with Bolt" } as const

let sessions = 0

/** A session row, as Better Auth would make it. */
async function makeSession(
  db: Db,
  userId: string,
  { expiresAt, updatedAt }: { expiresAt: Date; updatedAt: Date }
) {
  sessions += 1
  await db.insert(session).values({
    id: `purge-session-${sessions}`,
    token: `purge-token-${sessions}`,
    userId,
    createdAt: updatedAt,
    updatedAt,
    expiresAt,
  })
}

/**
 * A user whose every timestamp is `lastSeen`: made then, signed in then (the
 * session ran out a week later), and nothing since.
 */
async function makeIdle(
  db: Db,
  lastSeen: Date,
  fields: { isAnonymous?: boolean | null } = { isAnonymous: true }
) {
  const row = await makeUser(db)
  await db
    .update(user)
    .set({ ...fields, createdAt: lastSeen, updatedAt: lastSeen })
    .where(eq(user.id, row.id))
  await makeSession(db, row.id, {
    updatedAt: lastSeen,
    expiresAt: new Date(lastSeen.getTime() + 7 * DAY),
  })
  return row
}

async function userExists(db: Db, id: string) {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, id))
  return rows.length === 1
}

describe("deleteIdleGuests", () => {
  test("deletes a guest idle for more than 7 days, with all their data", async ({
    db,
  }) => {
    const guest = await makeIdle(db, daysAgo(8))
    const made = await createDraft(db, { userId: guest.id, ...nda })
    await saveMessages(db, { id: made.id, userId: guest.id }, [
      { id: "purge-m1", role: "user", parts: [{ type: "text", text: "Hi" }] },
    ])
    await db
      .update(draft)
      .set({ updatedAt: daysAgo(8) })
      .where(eq(draft.id, made.id))
    await db
      .insert(aiUsage)
      .values({ userId: guest.id, day: "2026-03-12", messages: 1 })

    expect(await purge(db)).toBe(1)

    expect(await userExists(db, guest.id)).toBe(false)
    expect(
      await db.select().from(draft).where(eq(draft.userId, guest.id))
    ).toEqual([])
    expect(
      await db.select().from(message).where(eq(message.draftId, made.id))
    ).toEqual([])
    expect(
      await db.select().from(aiUsage).where(eq(aiUsage.userId, guest.id))
    ).toEqual([])
    expect(
      await db.select().from(session).where(eq(session.userId, guest.id))
    ).toEqual([])
  })

  test("never deletes an account, however long it was idle", async ({ db }) => {
    const account = await makeIdle(db, daysAgo(400), { isAnonymous: false })
    // Better Auth's column allows null: that is not a guest either.
    const legacy = await makeIdle(db, daysAgo(400), { isAnonymous: null })

    expect(await purge(db)).toBe(0)

    expect(await userExists(db, account.id)).toBe(true)
    expect(await userExists(db, legacy.id)).toBe(true)
  })

  test("keeps a guest idle for exactly 7 days", async ({ db }) => {
    const guest = await makeIdle(db, inactiveSince)

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps a guest whose session is still valid", async ({ db }) => {
    const guest = await makeIdle(db, daysAgo(30))
    await makeSession(db, guest.id, {
      updatedAt: daysAgo(30),
      expiresAt: new Date(now.getTime() + 60_000),
    })

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps a guest whose session was used in the last 7 days", async ({
    db,
  }) => {
    const guest = await makeIdle(db, daysAgo(30))
    await makeSession(db, guest.id, {
      updatedAt: daysAgo(2),
      expiresAt: daysAgo(1),
    })

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps a guest whose draft changed in the last 7 days", async ({
    db,
  }) => {
    const guest = await makeIdle(db, daysAgo(30))
    const made = await createDraft(db, { userId: guest.id, ...nda })
    await db
      .update(draft)
      .set({ updatedAt: daysAgo(6) })
      .where(eq(draft.id, made.id))

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps a guest who used the AI in the last 7 days", async ({ db }) => {
    const guest = await makeIdle(db, daysAgo(30))
    // The day the cutoff falls on: part of it may be after the cutoff.
    await db
      .insert(aiUsage)
      .values({ userId: guest.id, day: "2026-03-13", messages: 1 })

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps a guest made or changed in the last 7 days", async ({ db }) => {
    const fresh = await makeIdle(db, daysAgo(1))
    const touched = await makeIdle(db, daysAgo(30))
    await db
      .update(user)
      .set({ updatedAt: daysAgo(3) })
      .where(eq(user.id, touched.id))

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, fresh.id)).toBe(true)
    expect(await userExists(db, touched.id)).toBe(true)
  })

  test("keeps a guest made in the last 7 days, whatever its other times say", async ({
    db,
  }) => {
    const guest = await makeIdle(db, daysAgo(30))
    await db
      .update(user)
      // updatedAt too, or Drizzle's $onUpdate sets it to the real now.
      .set({ createdAt: daysAgo(2), updatedAt: daysAgo(30) })
      .where(eq(user.id, guest.id))

    expect(await purge(db)).toBe(0)
    expect(await userExists(db, guest.id)).toBe(true)
  })

  test("keeps the drafts a guest gave to their account when they signed in", async ({
    db,
  }) => {
    const guest = await makeIdle(db, daysAgo(30))
    const account = await makeIdle(db, daysAgo(30), { isAnonymous: false })
    const made = await createDraft(db, { userId: guest.id, ...nda })
    await db
      .update(draft)
      .set({ updatedAt: daysAgo(30) })
      .where(eq(draft.id, made.id))
    await moveGuestData(db, { from: guest.id, to: account.id })

    expect(await purge(db)).toBe(1)

    const [kept] = await db
      .select({ userId: draft.userId })
      .from(draft)
      .where(eq(draft.id, made.id))
    expect(kept).toEqual({ userId: account.id })
  })

  test("deletes at most `limit` guests a call, and nothing twice", async ({
    db,
  }) => {
    const guests = []
    for (const days of [8, 9, 10])
      guests.push(await makeIdle(db, daysAgo(days)))

    expect(await purge(db, 2)).toBe(2)
    expect(await purge(db, 2)).toBe(1)
    expect(await purge(db, 2)).toBe(0)

    const left = await db
      .select()
      .from(user)
      .where(
        inArray(
          user.id,
          guests.map((guest) => guest.id)
        )
      )
    expect(left).toEqual([])
  })
})

describe("deleteIdleGuests while a guest signs in", () => {
  // Real commits on two connections, so the fixture's rollback can't help:
  // the rows are removed at the end.
  test("skips a guest whose drafts are being moved, without waiting", async () => {
    const id = `purge-linking-${crypto.randomUUID()}`
    const mover = await connect(inject("databaseUrl"))
    const cron = await connect(inject("databaseUrl"))
    try {
      await mover.insert(user).values({
        id,
        name: "Guest",
        email: `${id}@example.test`,
        isAnonymous: true,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(30),
      })

      const deleted = await mover.transaction(async (tx) => {
        // What moveGuestData holds while it moves the drafts.
        await tx.select().from(user).where(eq(user.id, id)).for("update")
        return deleteIdleGuests(cron, { now, inactiveSince, limit: 100 })
      })

      expect(deleted).toBe(0)
      expect(await userExists(mover, id)).toBe(true)
    } finally {
      await mover.delete(user).where(eq(user.id, id))
      await mover.$client.end()
      await cron.$client.end()
    }
  })
})

describe("deleteExpiredSessions", () => {
  test("deletes the sessions that ran out, any user's", async ({ db }) => {
    const account = await makeUser(db)
    await makeSession(db, account.id, {
      updatedAt: daysAgo(10),
      expiresAt: daysAgo(3),
    })

    expect(await deleteExpiredSessions(db, { now, limit: 100 })).toBe(1)

    const left = await db
      .select()
      .from(session)
      .where(eq(session.userId, account.id))
    expect(left).toEqual([])
    expect(await userExists(db, account.id)).toBe(true)
  })

  test("keeps sessions that are still valid", async ({ db }) => {
    const account = await makeUser(db)
    await makeSession(db, account.id, {
      updatedAt: daysAgo(1),
      expiresAt: new Date(now.getTime() + 60_000),
    })

    expect(await deleteExpiredSessions(db, { now, limit: 100 })).toBe(0)

    const left = await db
      .select()
      .from(session)
      .where(eq(session.userId, account.id))
    expect(left).toHaveLength(1)
  })

  test("deletes at most `limit` sessions a call", async ({ db }) => {
    const account = await makeUser(db)
    for (const days of [2, 3, 4])
      await makeSession(db, account.id, {
        updatedAt: daysAgo(days + 7),
        expiresAt: daysAgo(days),
      })

    expect(await deleteExpiredSessions(db, { now, limit: 2 })).toBe(2)
    expect(await deleteExpiredSessions(db, { now, limit: 2 })).toBe(1)
    expect(await deleteExpiredSessions(db, { now, limit: 2 })).toBe(0)
  })
})
