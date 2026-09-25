import { eq } from "drizzle-orm"
import { describe, expect } from "vite-plus/test"

import { createDraft, deleteDraft } from "../src/queries/drafts.ts"
import {
  activeShare,
  revokeShares,
  shareDraft,
  sharedDraft,
} from "../src/queries/shares.ts"
import { share } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

const nda = {
  documentId: "mutual-nda",
  title: "NDA with Bolt",
  fields: { purpose: "Talks about a deal" },
} as const
const at = new Date("2026-09-25T10:00:00Z")

describe("shareDraft", () => {
  test("makes a link of 128 random bits, base64url", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    const link = await shareDraft(db, { id: draft.id, userId: owner.id })

    // 16 bytes are 22 base64url letters without padding.
    expect(link?.token).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  test("gives the same link while it is on", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    const first = await shareDraft(db, key)
    const second = await shareDraft(db, key)

    expect(second?.token).toBe(first?.token)
    expect(
      await db.select().from(share).where(eq(share.draftId, draft.id))
    ).toHaveLength(1)
  })

  test("makes a new link after the old one was turned off", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const old = await shareDraft(db, key)

    await revokeShares(db, key, at)
    const fresh = await shareDraft(db, key)

    expect(fresh?.token).not.toBe(old?.token)
    expect(await sharedDraft(db, old?.token ?? "")).toBeUndefined()
  })

  test("never shares another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    const link = await shareDraft(db, { id: draft.id, userId: other.id })

    expect(link).toBeUndefined()
    expect(
      await db.select().from(share).where(eq(share.draftId, draft.id))
    ).toEqual([])
  })

  test("gives every draft its own link", async ({ db }) => {
    const owner = await makeUser(db)
    const one = await createDraft(db, { userId: owner.id, ...nda })
    const two = await createDraft(db, { userId: owner.id, ...nda })

    const first = await shareDraft(db, { id: one.id, userId: owner.id })
    const second = await shareDraft(db, { id: two.id, userId: owner.id })

    expect(first?.token).not.toBe(second?.token)
  })
})

describe("activeShare", () => {
  test("gives the draft's live link, or undefined", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    expect(await activeShare(db, key)).toBeUndefined()
    const link = await shareDraft(db, key)
    expect(await activeShare(db, key)).toEqual(link)
    await revokeShares(db, key, at)
    expect(await activeShare(db, key)).toBeUndefined()
  })

  test("never tells another user", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    await shareDraft(db, { id: draft.id, userId: owner.id })

    expect(
      await activeShare(db, { id: draft.id, userId: other.id })
    ).toBeUndefined()
  })
})

describe("revokeShares", () => {
  test("turns the draft's link off, and keeps the row", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const link = await shareDraft(db, key)

    const revoked = await revokeShares(db, key, at)

    expect(revoked).toBe(1)
    expect(
      await db
        .select({ revokedAt: share.revokedAt })
        .from(share)
        .where(eq(share.token, link?.token ?? ""))
    ).toEqual([{ revokedAt: at }])
  })

  test("keeps the first time a link was turned off", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await shareDraft(db, key)
    await revokeShares(db, key, at)

    const again = await revokeShares(db, key, new Date("2026-09-26T10:00:00Z"))

    expect(again).toBe(0)
    expect(
      await db
        .select({ revokedAt: share.revokedAt })
        .from(share)
        .where(eq(share.draftId, draft.id))
    ).toEqual([{ revokedAt: at }])
  })

  test("never turns off another user's link", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const link = await shareDraft(db, { id: draft.id, userId: owner.id })

    const revoked = await revokeShares(
      db,
      { id: draft.id, userId: other.id },
      at
    )

    expect(revoked).toBe(0)
    expect(await sharedDraft(db, link?.token ?? "")).toBeDefined()
  })
})

describe("sharedDraft", () => {
  test("gives only what the page shows: title, agreement and values", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const link = await shareDraft(db, { id: draft.id, userId: owner.id })

    const shared = await sharedDraft(db, link?.token ?? "")

    // No draft id, owner, status or dates: nothing to find the rest with.
    expect(shared).toEqual({
      title: "NDA with Bolt",
      documentId: "mutual-nda",
      fields: { purpose: "Talks about a deal" },
    })
  })

  test("finds nothing for an unknown token", async ({ db }) => {
    expect(await sharedDraft(db, "AAAAAAAAAAAAAAAAAAAAAA")).toBeUndefined()
  })

  test("finds nothing once the draft is deleted", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const link = await shareDraft(db, key)

    await deleteDraft(db, key)

    expect(await sharedDraft(db, link?.token ?? "")).toBeUndefined()
  })
})
