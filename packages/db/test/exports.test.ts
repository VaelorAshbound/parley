import { eq, sql } from "drizzle-orm"
import { describe, expect, inject } from "vite-plus/test"

import { user } from "../src/auth-schema.ts"
import { connect } from "../src/client.ts"
import { createDraft, deleteDraft, getDraft } from "../src/queries/drafts.ts"
import {
  countedAt,
  countExportsSince,
  lockExports,
  recordExport,
} from "../src/queries/exports.ts"
import { countedExport } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

const nda = { documentId: "mutual-nda", title: "NDA with Bolt" } as const
const september = new Date("2026-09-01T00:00:00Z")

describe("recordExport", () => {
  test("marks the draft exported and counts it for its owner", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const at = new Date("2026-09-10T12:00:00Z")

    await recordExport(db, { id: draft.id, userId: owner.id }, at)

    expect(
      (await getDraft(db, { id: draft.id, userId: owner.id }))?.firstExportedAt
    ).toEqual(at)
    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(1)
  })

  test("counts the agreement the draft is on", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    await recordExport(
      db,
      { id: draft.id, userId: owner.id },
      new Date("2026-09-10T12:00:00Z")
    )

    expect(
      await db
        .select({ documentId: countedExport.documentId })
        .from(countedExport)
        .where(eq(countedExport.draftId, draft.id))
    ).toEqual([{ documentId: "mutual-nda" }])
  })

  test("keeps the first export's time", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const first = new Date("2026-09-10T12:00:00Z")

    await recordExport(db, key, first)
    await recordExport(db, key, new Date("2026-09-11T12:00:00Z"))

    expect((await getDraft(db, key))?.firstExportedAt).toEqual(first)
  })

  test("leaves the draft's place in the sidebar alone", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    await recordExport(db, key, new Date("2026-09-10T12:00:00Z"))

    expect((await getDraft(db, key))?.updatedAt).toEqual(draft.updatedAt)
  })

  test("never marks another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    const recorded = await recordExport(
      db,
      { id: draft.id, userId: other.id },
      new Date("2026-09-10T12:00:00Z")
    )

    expect(recorded).toBe(false)
    expect(
      (await getDraft(db, { id: draft.id, userId: owner.id }))?.firstExportedAt
    ).toBeNull()
    expect(
      await countExportsSince(db, { userId: other.id, since: september })
    ).toBe(0)
  })
})

describe("countedAt", () => {
  test("gives when a draft's agreement was counted, or null", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const at = new Date("2026-09-10T12:00:00Z")
    await recordExport(db, { id: draft.id, userId: owner.id }, at)

    expect(
      await countedAt(db, { draftId: draft.id, documentId: "mutual-nda" })
    ).toEqual(at)
    expect(
      await countedAt(db, { draftId: draft.id, documentId: "pilot-agreement" })
    ).toBeNull()
  })
})

describe("countExportsSince", () => {
  test("counts from the given moment on, not before", async ({ db }) => {
    const owner = await makeUser(db)
    for (const at of [
      "2026-08-31T23:59:59.999Z",
      "2026-09-01T00:00:00Z",
      "2026-09-30T23:59:59Z",
    ]) {
      const draft = await createDraft(db, { userId: owner.id, ...nda })
      await recordExport(db, { id: draft.id, userId: owner.id }, new Date(at))
    }

    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(2)
  })

  test("counts only the user's own exports", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: other.id, ...nda })
    await recordExport(
      db,
      { id: draft.id, userId: other.id },
      new Date("2026-09-10T12:00:00Z")
    )

    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(0)
  })

  test("still counts a document after its draft is deleted", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await recordExport(db, key, new Date("2026-09-10T12:00:00Z"))

    await deleteDraft(db, key)

    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(1)
  })

  test("forgets the counts with the user", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    await recordExport(
      db,
      { id: draft.id, userId: owner.id },
      new Date("2026-09-10T12:00:00Z")
    )

    await db.delete(user).where(eq(user.id, owner.id))

    expect(
      await db
        .select()
        .from(countedExport)
        .where(eq(countedExport.userId, owner.id))
    ).toEqual([])
  })
})

describe("lockExports", () => {
  // Two connections, as two requests would have: the test's own transaction
  // can't show a lock, since a session never waits for itself.
  test("makes a second export by the same user wait for the first", async () => {
    const first = await connect(inject("databaseUrl"))
    const second = await connect(inject("databaseUrl"))
    try {
      const order: string[] = []
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      let locked = () => {}
      const isLocked = new Promise<void>((resolve) => (locked = resolve))

      const one = first.transaction(async (tx) => {
        await lockExports(tx, "user-lock-test")
        locked()
        await held
        order.push("first done")
      })
      await isLocked
      const two = second.transaction(async (tx) => {
        await lockExports(tx, "user-lock-test")
        order.push("second in")
      })
      // Give the second a moment to (wrongly) get in.
      await new Promise((resolve) => setTimeout(resolve, 100))
      release()
      await Promise.all([one, two])

      expect(order).toEqual(["first done", "second in"])
    } finally {
      await first.$client.end()
      await second.$client.end()
    }
  })

  test("doesn't make another user's export wait", async () => {
    const first = await connect(inject("databaseUrl"))
    const second = await connect(inject("databaseUrl"))
    try {
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      let locked = () => {}
      const isLocked = new Promise<void>((resolve) => (locked = resolve))

      const one = first.transaction(async (tx) => {
        await lockExports(tx, "user-a")
        locked()
        await held
      })
      await isLocked
      const got = await second.transaction(async (tx) => {
        await lockExports(tx, "user-b")
        return (await tx.execute(sql`select 1 as ok`)).rows
      })
      release()
      await one

      expect(got).toEqual([{ ok: 1 }])
    } finally {
      await first.$client.end()
      await second.$client.end()
    }
  })
})
