import { eq, sql } from "drizzle-orm"
import { describe, expect, inject } from "vite-plus/test"

import { user } from "../src/auth-schema.ts"
import { connect } from "../src/client.ts"
import {
  createDraft,
  deleteDraft,
  getDraft,
  updateDraft,
} from "../src/queries/drafts.ts"
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
/** The agreement the file was printed as. */
const printed = { documentId: "mutual-nda" } as const

describe("recordExport", () => {
  test("marks the draft exported and counts it for its owner", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const at = new Date("2026-09-10T12:00:00Z")

    await recordExport(db, { id: draft.id, userId: owner.id }, at, printed)

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
      new Date("2026-09-10T12:00:00Z"),
      printed
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

    // True only for the export that counted.
    expect(await recordExport(db, key, first, printed)).toBe(true)
    expect(
      await recordExport(db, key, new Date("2026-09-11T12:00:00Z"), printed)
    ).toBe(false)

    expect((await getDraft(db, key))?.firstExportedAt).toEqual(first)
  })

  // PAR-51 (c): the user keeps the file printed before an agreement switch,
  // so the count goes to the agreement in the file, not the one the draft
  // is on now.
  test("counts the agreement printed even after the draft moved to another", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const at = new Date("2026-09-10T12:00:00Z")
    await updateDraft(db, key, { documentId: "pilot-agreement" })

    expect(await recordExport(db, key, at, printed)).toBe(true)

    expect(
      await countedAt(db, { draftId: draft.id, documentId: "mutual-nda" })
    ).toEqual(at)
    // The draft is on the Pilot Agreement, which was never downloaded.
    expect((await getDraft(db, key))?.firstExportedAt).toBeNull()
    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(1)
  })

  test("counts an agreement printed before a switch only once", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await updateDraft(db, key, { documentId: "pilot-agreement" })
    const first = new Date("2026-09-10T12:00:00Z")

    expect(await recordExport(db, key, first, printed)).toBe(true)
    expect(
      await recordExport(db, key, new Date("2026-09-11T12:00:00Z"), printed)
    ).toBe(false)

    expect(
      await countedAt(db, { draftId: draft.id, documentId: "mutual-nda" })
    ).toEqual(first)
    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(1)
  })

  test("leaves the draft's place in the sidebar alone", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    await recordExport(db, key, new Date("2026-09-10T12:00:00Z"), printed)

    expect((await getDraft(db, key))?.updatedAt).toEqual(draft.updatedAt)
  })

  test("never marks another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    const recorded = await recordExport(
      db,
      { id: draft.id, userId: other.id },
      new Date("2026-09-10T12:00:00Z"),
      printed
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

describe("recordExport under the draft's row lock", () => {
  // Why the export counts while holding the draft's row (PAR-51): a switch
  // back to the agreement printed (chooseDocument) reads countedAt under
  // that lock to set firstExportedAt. Holding it until the count commits
  // means the switch can only read the count after it, never "not counted"
  // just before it. Two connections, as two requests would have.
  test("makes a switch back to the agreement printed see the count", async () => {
    const setup = await connect(inject("databaseUrl"))
    const first = await connect(inject("databaseUrl"))
    const second = await connect(inject("databaseUrl"))
    // Committed rows, so a unique id that no other test uses.
    const userId = `user-lock-${crypto.randomUUID()}`
    try {
      await setup
        .insert(user)
        .values({ id: userId, name: "Lock", email: `${userId}@example.test` })
      const draft = await createDraft(setup, { userId, ...nda })
      const key = { id: draft.id, userId }
      // Switched away while the Mutual NDA printed.
      await updateDraft(setup, key, { documentId: "pilot-agreement" })
      const at = new Date("2026-09-10T12:00:00Z")
      let release = () => {}
      const held = new Promise<void>((resolve) => (release = resolve))
      let counted = () => {}
      const isCounted = new Promise<void>((resolve) => (counted = resolve))

      const exporting = first.transaction(async (tx) => {
        await getDraft(tx, key, { lock: true })
        await recordExport(tx, key, at, printed)
        counted()
        await held
      })
      await isCounted
      const switching = second.transaction(async (tx) => {
        await getDraft(tx, key, { lock: true })
        return countedAt(tx, { draftId: draft.id, documentId: "mutual-nda" })
      })
      // Give the switch a moment to (wrongly) read before the commit.
      await new Promise((resolve) => setTimeout(resolve, 100))
      release()
      const [, seen] = await Promise.all([exporting, switching])

      expect(seen).toEqual(at)
    } finally {
      await setup.delete(user).where(eq(user.id, userId))
      await setup.$client.end()
      await first.$client.end()
      await second.$client.end()
    }
  })
})

describe("countedAt", () => {
  test("gives when a draft's agreement was counted, or null", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const at = new Date("2026-09-10T12:00:00Z")
    await recordExport(db, { id: draft.id, userId: owner.id }, at, printed)

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
      await recordExport(
        db,
        { id: draft.id, userId: owner.id },
        new Date(at),
        printed
      )
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
      new Date("2026-09-10T12:00:00Z"),
      printed
    )

    expect(
      await countExportsSince(db, { userId: owner.id, since: september })
    ).toBe(0)
  })

  test("still counts a document after its draft is deleted", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await recordExport(db, key, new Date("2026-09-10T12:00:00Z"), printed)

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
      new Date("2026-09-10T12:00:00Z"),
      printed
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
