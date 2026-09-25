import { connect, listMessages, saveMessages, schema } from "@workspace/db"
import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
} from "cloudflare:test"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import { scheduled } from "../../web/src/server/cron"
import { call, cookiesFrom, serverClient, signInGuest } from "./helpers"

// T28: the nightly purge through the Worker's real scheduled() handler.
//
// The clock is fake: the purge reads the time only from the controller's
// scheduledTime, set here to a fixed day in the past. The tests move their
// own rows back in time. Every other test file shares this database, and
// its rows are newer than this clock, so they look active and are never
// touched while these tests run.

const DAY = 86_400_000
const now = new Date("2026-01-20T03:17:00.000Z")
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY)
const today = "2026-09-25"
/** The Cron Trigger in wrangler.jsonc. */
const cron = "17 3 * * *"

async function runCron(bindings: Env = env) {
  const controller = createScheduledController({
    scheduledTime: now,
    cron,
  })
  const ctx = createExecutionContext()
  await scheduled(controller, bindings, ctx)
  await waitOnExecutionContext(ctx)
}

async function database() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  return db
}

/**
 * Moves every time on the user's rows back to `at`, as if they signed in
 * then and did nothing since: the session ran out a week later.
 */
async function idleSince(userId: string, at: Date) {
  const db = await database()
  await db
    .update(schema.user)
    .set({ createdAt: at, updatedAt: at })
    .where(eq(schema.user.id, userId))
  await db
    .update(schema.session)
    .set({
      createdAt: at,
      updatedAt: at,
      expiresAt: new Date(at.getTime() + 7 * DAY),
    })
    .where(eq(schema.session.userId, userId))
  await db
    .update(schema.draft)
    .set({ createdAt: at, updatedAt: at })
    .where(eq(schema.draft.userId, userId))
}

async function userExists(id: string) {
  const db = await database()
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, id))
  return rows.length === 1
}

/** A real guest (Better Auth's own rows) with one draft and its chat. */
async function guestWithDraft() {
  const guest = await signInGuest()
  const client = await serverClient(guest.cookie)
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  const db = await database()
  await saveMessages(db, { id: draft.id, userId: draft.userId }, [
    {
      id: `m-${draft.id}`,
      role: "user",
      parts: [{ type: "text", text: "Hi" }],
    },
  ])
  return { ...guest, draft, userId: draft.userId }
}

async function signUp(cookie?: string) {
  const response = await call("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify({
      name: "Ana",
      email: `ana-${crypto.randomUUID()}@example.test`,
      password: "correct horse 1",
    }),
  })
  expect(response.status).toBe(200)
  return { cookie: cookiesFrom(response) }
}

async function userIdOf(cookie: string) {
  const response = await call("/api/auth/get-session", { headers: { cookie } })
  const body: { user: { id: string } } = await response.json()
  return body.user.id
}

/** The console lines written while `run` runs. */
async function captured(run: () => Promise<unknown>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  using error = vi.spyOn(console, "error").mockImplementation(() => {})
  const outcome = await run().then(
    () => "ok",
    (failure: unknown) => failure
  )
  const lines = [info, error]
    .flatMap((spy) => spy.mock.calls)
    .map(([line]) => line as Record<string, unknown>)
  return { outcome, lines }
}

describe("the nightly purge", () => {
  it("deletes a guest idle for more than 7 days, with their draft, chat and sessions", async () => {
    const guest = await guestWithDraft()
    await idleSince(guest.userId, daysAgo(8))

    await runCron()

    expect(await userExists(guest.userId)).toBe(false)
    const db = await database()
    expect(
      await db
        .select()
        .from(schema.draft)
        .where(eq(schema.draft.id, guest.draft.id))
    ).toEqual([])
    expect(
      await listMessages(db, { id: guest.draft.id, userId: guest.userId })
    ).toEqual([])
    expect(
      await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, guest.userId))
    ).toEqual([])
  })

  it("keeps a guest idle for less than 7 days", async () => {
    const guest = await guestWithDraft()
    await idleSince(guest.userId, daysAgo(6))
    // Their session ran out, so only the 6-day-old activity keeps them.
    const db = await database()
    await db
      .update(schema.session)
      // updatedAt too, or Drizzle's $onUpdate sets it to the real now.
      .set({ expiresAt: daysAgo(1), updatedAt: daysAgo(6) })
      .where(eq(schema.session.userId, guest.userId))

    await runCron()

    expect(await userExists(guest.userId)).toBe(true)
  })

  it("never deletes an account, however long it was idle", async () => {
    const account = await signUp()
    const userId = await userIdOf(account.cookie)
    await idleSince(userId, daysAgo(365))

    await runCron()

    expect(await userExists(userId)).toBe(true)
  })

  it("keeps the draft and chat of a guest who signed up", async () => {
    const guest = await guestWithDraft()
    const account = await signUp(guest.cookie)
    const userId = await userIdOf(account.cookie)
    // The draft keeps its old time when it moves (a move is not an edit).
    await idleSince(userId, daysAgo(30))

    await runCron()

    const db = await database()
    const [draft] = await db
      .select({ userId: schema.draft.userId })
      .from(schema.draft)
      .where(eq(schema.draft.id, guest.draft.id))
    expect(draft).toEqual({ userId })
    expect(await listMessages(db, { id: guest.draft.id, userId })).toHaveLength(
      1
    )
  })

  it("deletes expired sessions and keeps valid ones", async () => {
    const account = await signUp()
    const userId = await userIdOf(account.cookie)
    const db = await database()
    // Two devices: one signed in a month ago (ran out), one still valid.
    await db.insert(schema.session).values([
      {
        id: `expired-${userId}`,
        token: `expired-${userId}`,
        userId,
        updatedAt: daysAgo(30),
        expiresAt: daysAgo(23),
      },
      {
        id: `valid-${userId}`,
        token: `valid-${userId}`,
        userId,
        updatedAt: daysAgo(1),
        expiresAt: new Date(now.getTime() + 6 * DAY),
      },
    ])

    await runCron()

    const left = await db
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(eq(schema.session.userId, userId))
    expect(left.map((row) => row.id)).not.toContain(`expired-${userId}`)
    expect(left.map((row) => row.id)).toContain(`valid-${userId}`)
  })

  it("logs what it deleted, and a second run finds nothing left", async () => {
    const first = await guestWithDraft()
    const second = await guestWithDraft()
    await idleSince(first.userId, daysAgo(10))
    await idleSince(second.userId, daysAgo(40))

    const once = await captured(() => runCron())
    const twice = await captured(() => runCron())

    expect(once.outcome).toBe("ok")
    expect(once.lines).toEqual([
      {
        level: "info",
        event: "purge_done",
        cron,
        guests: 2,
        sessions: 0,
        complete: true,
        durationMs: expect.any(Number),
      },
    ])
    expect(twice.lines).toEqual([
      expect.objectContaining({ event: "purge_done", guests: 0, sessions: 0 }),
    ])
  })

  it("fails loudly when the database refuses, so the Cron Events show it", async () => {
    const guest = await guestWithDraft()
    await idleSince(guest.userId, daysAgo(8))
    const url = new URL(env.HYPERDRIVE.connectionString)
    url.searchParams.set("options", "-c default_transaction_read_only=on")
    const readOnly: Env = {
      ...env,
      HYPERDRIVE: Object.create(env.HYPERDRIVE, {
        connectionString: { value: url.toString() },
      }),
    }

    const { outcome, lines } = await captured(() => runCron(readOnly))

    expect(outcome).toBeInstanceOf(Error)
    expect(lines).toEqual([
      expect.objectContaining({
        level: "error",
        event: "purge_failed",
        error: expect.objectContaining({ code: "25006" }),
      }),
    ])
    expect(await userExists(guest.userId)).toBe(true)
    // Cleans up after itself: the next test's counts start from zero.
    await runCron()
  })

  it("fails loudly when it can't reach the database", async () => {
    const url = new URL(env.HYPERDRIVE.connectionString)
    url.port = "1"
    const unreachable: Env = {
      ...env,
      HYPERDRIVE: Object.create(env.HYPERDRIVE, {
        connectionString: { value: url.toString() },
      }),
    }

    const { outcome, lines } = await captured(() => runCron(unreachable))

    expect(outcome).toBeInstanceOf(Error)
    expect(lines).toEqual([
      expect.objectContaining({ level: "error", event: "purge_failed" }),
    ])
  })
})
