import { eq, inArray, sql } from "drizzle-orm"
import { describe, expect, inject } from "vite-plus/test"

import { rateLimit, session, user, verification } from "../src/auth-schema.ts"
import { connect, type Db } from "../src/client.ts"
import { createDraft } from "../src/queries/drafts.ts"
import { moveGuestData } from "../src/queries/guests.ts"
import { saveMessages } from "../src/queries/messages.ts"
import {
  deleteExpiredSessions,
  deleteExpiredVerifications,
  deleteIdleGuests,
  deleteOldRateLimits,
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

  // One time exactly on the cutoff, every other one long before it: only
  // that one comparison can keep the guest, so an off-by-one in it fails.
  describe("keeps a guest when one time is exactly on the cutoff", () => {
    test("made exactly 7 days ago", async ({ db }) => {
      const guest = await makeIdle(db, daysAgo(30))
      await db
        .update(user)
        .set({ createdAt: inactiveSince, updatedAt: daysAgo(30) })
        .where(eq(user.id, guest.id))

      expect(await purge(db)).toBe(0)
      expect(await userExists(db, guest.id)).toBe(true)
    })

    test("changed exactly 7 days ago", async ({ db }) => {
      const guest = await makeIdle(db, daysAgo(30))
      await db
        .update(user)
        .set({ updatedAt: inactiveSince })
        .where(eq(user.id, guest.id))

      expect(await purge(db)).toBe(0)
      expect(await userExists(db, guest.id)).toBe(true)
    })

    test("a session used exactly 7 days ago", async ({ db }) => {
      const guest = await makeIdle(db, daysAgo(30))
      await makeSession(db, guest.id, {
        updatedAt: inactiveSince,
        expiresAt: daysAgo(1),
      })

      expect(await purge(db)).toBe(0)
      expect(await userExists(db, guest.id)).toBe(true)
    })

    test("a session that runs out right now", async ({ db }) => {
      const guest = await makeIdle(db, daysAgo(30))
      // Better Auth still accepts it: a session is out only once expiresAt < now.
      await makeSession(db, guest.id, {
        updatedAt: daysAgo(30),
        expiresAt: now,
      })

      expect(await purge(db)).toBe(0)
      expect(await userExists(db, guest.id)).toBe(true)
    })

    test("a draft changed exactly 7 days ago", async ({ db }) => {
      const guest = await makeIdle(db, daysAgo(30))
      const made = await createDraft(db, { userId: guest.id, ...nda })
      await db
        .update(draft)
        .set({ updatedAt: inactiveSince })
        .where(eq(draft.id, made.id))

      expect(await purge(db)).toBe(0)
      expect(await userExists(db, guest.id)).toBe(true)
    })
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

let verifications = 0

/** A verification row (a reset link, a two-factor code), as Better Auth makes it. */
async function makeVerification(db: Db, expiresAt: Date) {
  verifications += 1
  const id = `purge-verification-${verifications}`
  await db.insert(verification).values({
    id,
    identifier: `reset-password:${id}`,
    value: id,
    expiresAt,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  })
  return id
}

async function verificationIds(db: Db) {
  const rows = await db
    .select({ id: verification.id })
    .from(verification)
    .orderBy(verification.id)
  return rows.map((row) => row.id)
}

describe("deleteExpiredVerifications", () => {
  test("deletes the verification rows that ran out", async ({ db }) => {
    await makeVerification(db, daysAgo(2))
    await makeVerification(db, new Date(now.getTime() - 1))

    expect(await deleteExpiredVerifications(db, { now, limit: 100 })).toBe(2)
    expect(await verificationIds(db)).toEqual([])
  })

  test("keeps a row that is still valid, also one that runs out right now", async ({
    db,
  }) => {
    // Better Auth accepts a code until expiresAt < now, like a session.
    const later = await makeVerification(db, new Date(now.getTime() + 60_000))
    const exactlyNow = await makeVerification(db, now)

    expect(await deleteExpiredVerifications(db, { now, limit: 100 })).toBe(0)
    expect(await verificationIds(db)).toEqual([later, exactlyNow].toSorted())
  })

  test("deletes at most `limit` rows a call", async ({ db }) => {
    for (const days of [1, 2, 3]) await makeVerification(db, daysAgo(days))

    expect(await deleteExpiredVerifications(db, { now, limit: 2 })).toBe(2)
    expect(await deleteExpiredVerifications(db, { now, limit: 2 })).toBe(1)
    expect(await deleteExpiredVerifications(db, { now, limit: 2 })).toBe(0)
  })
})

let rateLimits = 0

/** A rate_limit row, as Better Auth keeps it: last request in epoch ms. */
async function makeRateLimit(db: Db, lastRequest: Date) {
  rateLimits += 1
  const id = `purge-rate-limit-${rateLimits}`
  await db.insert(rateLimit).values({
    id,
    key: `203.0.113.${rateLimits}/sign-in/anonymous`,
    count: 10,
    lastRequest: lastRequest.getTime(),
  })
  return id
}

async function rateLimitIds(db: Db) {
  const rows = await db
    .select({ id: rateLimit.id })
    .from(rateLimit)
    .orderBy(rateLimit.id)
  return rows.map((row) => row.id)
}

describe("deleteOldRateLimits", () => {
  /** The cron's cutoff: far past the longest window (cron.ts). */
  const before = daysAgo(1)

  test("deletes the rows whose last request is before the cutoff", async ({
    db,
  }) => {
    await makeRateLimit(db, daysAgo(2))
    await makeRateLimit(db, new Date(before.getTime() - 1))

    expect(await deleteOldRateLimits(db, { before, limit: 100 })).toBe(2)
    expect(await rateLimitIds(db)).toEqual([])
  })

  test("keeps a row whose last request is on or after the cutoff", async ({
    db,
  }) => {
    // A guest blocked an hour ago is still blocked: its row must stay.
    const blocked = await makeRateLimit(db, new Date(now.getTime() - 3_600_000))
    const onCutoff = await makeRateLimit(db, before)

    expect(await deleteOldRateLimits(db, { before, limit: 100 })).toBe(0)
    expect(await rateLimitIds(db)).toEqual([blocked, onCutoff].toSorted())
  })

  test("deletes at most `limit` rows a call", async ({ db }) => {
    for (const days of [2, 3, 4]) await makeRateLimit(db, daysAgo(days))

    expect(await deleteOldRateLimits(db, { before, limit: 2 })).toBe(2)
    expect(await deleteOldRateLimits(db, { before, limit: 2 })).toBe(1)
    expect(await deleteOldRateLimits(db, { before, limit: 2 })).toBe(0)
  })
})

// Each purge scans for rows past a time. Without an index on that column the
// scan reads the whole table every night, and Better Auth's own prune of
// rate_limit (on each new window) does too (PAR-14). Sequential scans are
// turned off so the plan shows whether an index can serve the query at all;
// on a few test rows the planner would pick a scan either way.
describe("the purge queries use an index", () => {
  async function plan(db: Db, query: ReturnType<typeof sql>) {
    await db.execute(sql`SET LOCAL enable_seqscan = off`)
    const result = await db.execute<{ "QUERY PLAN": string }>(
      sql`EXPLAIN ${query}`
    )
    return result.rows.map((row) => row["QUERY PLAN"]).join("\n")
  }

  test("expired sessions, by session.expires_at", async ({ db }) => {
    const explained = await plan(
      db,
      sql`SELECT id FROM session WHERE expires_at < ${now} LIMIT 500 FOR UPDATE SKIP LOCKED`
    )
    expect(explained).toContain("session_expiresAt_idx")
  })

  test("old rate_limit rows, by rate_limit.last_request", async ({ db }) => {
    const explained = await plan(
      db,
      sql`SELECT id FROM rate_limit WHERE last_request < ${daysAgo(1).getTime()} LIMIT 500 FOR UPDATE SKIP LOCKED`
    )
    expect(explained).toContain("rateLimit_lastRequest_idx")
  })
})
