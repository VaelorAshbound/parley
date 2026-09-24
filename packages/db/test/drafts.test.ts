import { eq, sql } from "drizzle-orm"
import { test as base, describe, expect, inject } from "vite-plus/test"

import { user } from "../src/auth-schema.ts"
import { connect } from "../src/client.ts"
import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  listDraftsQuery,
  updateDraft,
} from "../src/queries/drafts.ts"
import { draft, message, share } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

const nda = {
  documentId: "mutual-nda",
  title: "NDA with Bolt",
} as const

describe("createDraft", () => {
  test("starts an empty draft owned by the user", async ({ db }) => {
    const owner = await makeUser(db)

    const created = await createDraft(db, { userId: owner.id, ...nda })

    expect(created).toMatchObject({
      userId: owner.id,
      documentId: "mutual-nda",
      title: "NDA with Bolt",
      fields: {},
      status: "drafting",
      firstExportedAt: null,
    })
    expect(created.createdAt).toBeInstanceOf(Date)
  })

  test("gives time-ordered ids (uuid v7)", async ({ db }) => {
    const owner = await makeUser(db)

    const first = await createDraft(db, { userId: owner.id, ...nda })
    const second = await createDraft(db, { userId: owner.id, ...nda })

    expect(first.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-/)
    expect(second.id > first.id).toBe(true)
  })

  test("keeps the field values it is given", async ({ db }) => {
    const owner = await makeUser(db)
    const fields = { party1: { company: "Acme Analytics, Inc." } }

    const created = await createDraft(db, {
      userId: owner.id,
      ...nda,
      fields,
    })

    expect(created.fields).toEqual(fields)
  })

  test("doesn't return the internal search column", async ({ db }) => {
    const owner = await makeUser(db)

    const created = await createDraft(db, { userId: owner.id, ...nda })

    expect(created).not.toHaveProperty("search")
  })
})

describe("getDraft", () => {
  test("finds a draft for its owner", async ({ db }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    expect(await getDraft(db, { id: created.id, userId: owner.id })).toEqual(
      created
    )
  })

  test("finds nothing for another user", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    expect(
      await getDraft(db, { id: created.id, userId: other.id })
    ).toBeUndefined()
  })

  test("finds nothing for an unknown id", async ({ db }) => {
    const owner = await makeUser(db)

    expect(
      await getDraft(db, {
        id: "01920000-0000-7000-8000-000000000000",
        userId: owner.id,
      })
    ).toBeUndefined()
  })
})

describe("listDrafts", () => {
  test("lists the user's drafts, last changed first", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const older = await createDraft(db, { userId: owner.id, ...nda })
    const newer = await createDraft(db, { userId: owner.id, ...nda })
    await createDraft(db, { userId: other.id, ...nda })
    // now() is fixed inside a transaction, so set the order by hand.
    await db
      .update(draft)
      .set({ updatedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(draft.id, newer.id))
    await db
      .update(draft)
      .set({ updatedAt: new Date("2026-02-01T00:00:00Z") })
      .where(eq(draft.id, older.id))

    const listed = await listDrafts(db, { userId: owner.id })

    expect(listed.map((each) => each.id)).toEqual([older.id, newer.id])
  })

  test("returns only what the sidebar shows, up to the limit", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    await createDraft(db, { userId: owner.id, ...nda })
    await createDraft(db, { userId: owner.id, ...nda })

    const listed = await listDrafts(db, { userId: owner.id, limit: 1 })

    expect(listed).toEqual([
      {
        id: expect.any(String),
        documentId: "mutual-nda",
        title: "NDA with Bolt",
        status: "drafting",
        updatedAt: expect.any(Date),
      },
    ])
  })

  test("reads the order off the index, with no sort step", async ({ db }) => {
    const owner = await makeUser(db)
    // An empty table makes every plan cheap; leave only plain index scans, so
    // the plan shows whether the index alone gives the order.
    await db.execute(sql`SET LOCAL enable_seqscan = off`)
    await db.execute(sql`SET LOCAL enable_bitmapscan = off`)

    const plan = await db.execute<{ "QUERY PLAN": string }>(
      sql`EXPLAIN ${listDraftsQuery(db, { userId: owner.id })}`
    )
    const text = plan.rows.map((row) => row["QUERY PLAN"]).join("\n")

    expect(text).toContain("draft_user_id_updated_at_idx")
    expect(text).not.toContain("Sort")
  })
})

describe("updateDraft", () => {
  test("changes the owner's draft and returns it", async ({ db }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    const updated = await updateDraft(
      db,
      { id: created.id, userId: owner.id },
      { title: "NDA with Bolt Retail", fields: { purpose: "Resale" } }
    )

    expect(updated).toMatchObject({
      id: created.id,
      title: "NDA with Bolt Retail",
      fields: { purpose: "Resale" },
    })
    expect(await getDraft(db, { id: created.id, userId: owner.id })).toEqual(
      updated
    )
  })

  test("marks the draft as changed now", async ({ db }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })
    await db
      .update(draft)
      .set({ updatedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(draft.id, created.id))

    const updated = await updateDraft(
      db,
      { id: created.id, userId: owner.id },
      { status: "complete" }
    )

    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      new Date("2026-01-01T00:00:00Z").getTime()
    )
  })

  test("leaves another user's draft alone", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    const updated = await updateDraft(
      db,
      { id: created.id, userId: other.id },
      { title: "Taken" }
    )

    expect(updated).toBeUndefined()
    expect(
      (await getDraft(db, { id: created.id, userId: owner.id }))?.title
    ).toBe("NDA with Bolt")
  })
})

describe("deleteDraft", () => {
  test("deletes the owner's draft with its chat and share links", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })
    await db.insert(message).values({
      id: "m1",
      draftId: created.id,
      role: "user",
      parts: [{ type: "text", text: "Hi" }],
    })
    await db.insert(share).values({ token: "t1", draftId: created.id })

    expect(await deleteDraft(db, { id: created.id, userId: owner.id })).toBe(
      true
    )
    expect(await db.select().from(message)).toEqual([])
    expect(await db.select().from(share)).toEqual([])
  })

  test("can't delete another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    expect(await deleteDraft(db, { id: created.id, userId: other.id })).toBe(
      false
    )
    expect(
      await getDraft(db, { id: created.id, userId: owner.id })
    ).toBeDefined()
  })
})

describe("the schema", () => {
  test("deleting a user deletes their drafts (account delete, guest purge)", async ({
    db,
  }) => {
    const owner = await makeUser(db, { isAnonymous: true })
    await createDraft(db, { userId: owner.id, ...nda })

    await db.delete(user).where(eq(user.id, owner.id))

    expect(await db.select().from(draft)).toEqual([])
  })

  test("indexes the title, document type and party names for search", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, {
      userId: owner.id,
      documentId: "mutual-nda",
      title: "Roadmap review",
      fields: {
        party1: { company: "Acme Analytics, Inc.", name: "Ana Diaz" },
        party2: { company: "Bolt Retail LLC" },
        purpose: "Talk about Zenith",
      },
    })
    const find = async (query: string) =>
      (
        await db
          .select({ id: draft.id })
          .from(draft)
          .where(sql`${draft.search} @@ to_tsquery('simple', ${query})`)
      ).map((row) => row.id)

    expect(await find("roadm:*")).toEqual([created.id])
    expect(await find("nda")).toEqual([created.id])
    expect(await find("acme:* & bolt:*")).toEqual([created.id])
    expect(await find("diaz")).toEqual([created.id])
    // Other answers are not party names, so they don't match.
    expect(await find("zenith")).toEqual([])
  })
})

describe("getDraft with lock", () => {
  // Needs committed rows and two connections, so no rollback fixture here.
  base(
    "holds the row until the transaction ends, so edits can't cross",
    async () => {
      const first = await connect(inject("databaseUrl"))
      const second = await connect(inject("databaseUrl"))
      const [owner] = await first
        .insert(user)
        .values({ id: "lock-owner", name: "Lock", email: "lock@example.test" })
        .returning()
      const created = await createDraft(first, { userId: owner!.id, ...nda })
      try {
        await first.transaction(async (tx) => {
          await getDraft(
            tx,
            { id: created.id, userId: owner!.id },
            { lock: true }
          )

          await expect(
            second.execute(
              sql`SELECT id FROM draft WHERE id = ${created.id} FOR UPDATE NOWAIT`
            )
          ).rejects.toMatchObject({ cause: { code: "55P03" } })
        })
      } finally {
        await first.delete(user).where(eq(user.id, owner!.id))
        await first.$client.end()
        await second.$client.end()
      }
    }
  )
})
