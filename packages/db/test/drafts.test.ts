import { eq, sql } from "drizzle-orm"
import { test as base, describe, expect, inject } from "vite-plus/test"

import type { SQLWrapper } from "drizzle-orm"

import { user } from "../src/auth-schema.ts"
import { connect, type Db } from "../src/client.ts"
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  getDraft,
  listDrafts,
  listDraftsQuery,
  updateDraft,
  withinDraftLimit,
} from "../src/queries/drafts.ts"
import { draft, message, share } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

const nda = {
  documentId: "mutual-nda",
  title: "NDA with Bolt",
} as const

/** The query's plan as text. */
async function explain(db: Db, query: SQLWrapper) {
  const plan = await db.execute<{ "QUERY PLAN": string }>(sql`EXPLAIN ${query}`)
  return plan.rows.map((row) => row["QUERY PLAN"]).join("\n")
}

/**
 * `count` drafts for the user, changed one minute apart, oldest first; their
 * ids in that order.
 */
async function makeDrafts(db: Db, userId: string, count: number) {
  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO draft (user_id, document_id, title, updated_at)
    SELECT ${userId}, 'mutual-nda', 'Draft ' || n,
      timestamptz '2026-01-01' + n * interval '1 minute'
    FROM generate_series(1, ${count}) AS n
    RETURNING id`)
  return rows.rows.map((row) => row.id)
}

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

    const text = await explain(db, listDraftsQuery(db, { userId: owner.id }))

    expect(text).toContain("draft_user_id_updated_at_idx")
    expect(text).not.toContain("Sort")
  })

  test("reads the next page off the index too, with no sort step", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    await db.execute(sql`SET LOCAL enable_seqscan = off`)
    await db.execute(sql`SET LOCAL enable_bitmapscan = off`)

    const text = await explain(
      db,
      listDraftsQuery(db, {
        userId: owner.id,
        after: {
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          id: "01920000-0000-7000-8000-000000000000",
        },
      })
    )

    expect(text).toMatch(/Index Cond: .*updated_at/)
    expect(text).not.toContain("Sort")
  })
})

describe("listDrafts pages", () => {
  test("continues after the last draft of the page before", async ({ db }) => {
    const owner = await makeUser(db)
    const ids = await makeDrafts(db, owner.id, 5)

    const first = await listDrafts(db, { userId: owner.id, limit: 2 })
    const second = await listDrafts(db, {
      userId: owner.id,
      limit: 2,
      after: first.at(-1),
    })
    const third = await listDrafts(db, {
      userId: owner.id,
      limit: 2,
      after: second.at(-1),
    })

    expect([...first, ...second, ...third].map((each) => each.id)).toEqual(
      ids.toReversed()
    )
  })

  test("drafts changed in the same millisecond are neither skipped nor repeated", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const ids = await makeDrafts(db, owner.id, 4)
    await db
      .update(draft)
      .set({ updatedAt: new Date("2026-03-01T00:00:00.123Z") })
      .where(eq(draft.userId, owner.id))

    const first = await listDrafts(db, { userId: owner.id, limit: 2 })
    const second = await listDrafts(db, {
      userId: owner.id,
      limit: 2,
      after: first.at(-1),
    })

    expect([...first, ...second].map((each) => each.id)).toEqual(
      ids.toReversed()
    )
  })

  test("keeps the database's time exact to the millisecond, so a page's last time finds its place", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, { userId: owner.id, ...nda })

    const [row] = await db
      .select({
        exact: sql<boolean>`${draft.updatedAt} = ${created.updatedAt.toISOString()}::timestamptz`,
      })
      .from(draft)
      .where(eq(draft.id, created.id))

    expect(row?.exact).toBe(true)
  })
})

describe("listDrafts search", () => {
  async function seed(db: Db) {
    const owner = await makeUser(db)
    const acme = await createDraft(db, {
      userId: owner.id,
      documentId: "mutual-nda",
      title: "Roadmap review",
      fields: {
        party1: { company: "Acme Analytics, Inc.", name: "Ana Diaz" },
        party2: { company: "Bolt Retail LLC" },
      },
    })
    const pilot = await createDraft(db, {
      userId: owner.id,
      documentId: "pilot-agreement",
      title: "Pilot with Zenith",
      fields: { provider: { company: "Zenith Labs" } },
    })
    return { owner, acme, pilot }
  }
  const search = async (db: Db, userId: string, query: string) =>
    (await listDrafts(db, { userId, query })).map((each) => each.title)

  test("finds a draft by the start of a word, as you type", async ({ db }) => {
    const { owner } = await seed(db)

    expect(await search(db, owner.id, "roa")).toEqual(["Roadmap review"])
    expect(await search(db, owner.id, "ZEN")).toEqual(["Pilot with Zenith"])
  })

  test("finds a draft by a party's company or name", async ({ db }) => {
    const { owner } = await seed(db)

    expect(await search(db, owner.id, "bolt")).toEqual(["Roadmap review"])
    expect(await search(db, owner.id, "diaz")).toEqual(["Roadmap review"])
  })

  test("finds a draft by its document type", async ({ db }) => {
    const { owner } = await seed(db)

    expect(await search(db, owner.id, "pilot agree")).toEqual([
      "Pilot with Zenith",
    ])
    expect(await search(db, owner.id, "nda")).toEqual(["Roadmap review"])
  })

  test("needs every word to match", async ({ db }) => {
    const { owner } = await seed(db)

    expect(await search(db, owner.id, "acme bolt")).toEqual(["Roadmap review"])
    expect(await search(db, owner.id, "acme zenith")).toEqual([])
  })

  test("reads punctuation and search syntax as plain text", async ({ db }) => {
    const { owner } = await seed(db)

    expect(await search(db, owner.id, "Acme, Inc.")).toEqual(["Roadmap review"])
    expect(await search(db, owner.id, "!acme | ' & :* (")).toEqual([
      "Roadmap review",
    ])
    expect(await search(db, owner.id, "(&)")).toEqual([
      "Pilot with Zenith",
      "Roadmap review",
    ])
  })

  test("never finds another user's drafts", async ({ db }) => {
    await seed(db)
    const other = await makeUser(db)

    expect(await search(db, other.id, "acme")).toEqual([])
  })

  test("filters by document type, alone or with a search", async ({ db }) => {
    const { owner } = await seed(db)

    const pilots = await listDrafts(db, {
      userId: owner.id,
      documentId: "pilot-agreement",
    })
    const none = await listDrafts(db, {
      userId: owner.id,
      documentId: "pilot-agreement",
      query: "acme",
    })

    expect(pilots.map((each) => each.title)).toEqual(["Pilot with Zenith"])
    expect(none).toEqual([])
  })

  /**
   * Many users with many drafts, as in production, so the plan is the one
   * Postgres would really choose (scripts/bench-history.ts measures more):
   * the owner has 1,000 of 11,000, and one of theirs names Quokka Systems.
   */
  async function seedMany(db: Db) {
    const owner = await makeUser(db)
    await db.execute(sql`
      INSERT INTO "user" (id, name, email)
      SELECT 'many-' || n, 'Many ' || n, 'many-' || n || '@example.test'
      FROM generate_series(1, 200) AS n`)
    await db.execute(sql`
      INSERT INTO draft (user_id, document_id, title)
      SELECT 'many-' || (n % 200 + 1), 'mutual-nda', 'Draft ' || n
      FROM generate_series(1, 10000) AS n`)
    await makeDrafts(db, owner.id, 1000)
    await createDraft(db, {
      userId: owner.id,
      ...nda,
      fields: { party1: { company: "Quokka Systems" } },
    })
    // What autovacuum does in production: move the new rows out of the GIN
    // index's pending list, which Postgres would otherwise scan in full.
    await db.execute(sql`SELECT gin_clean_pending_list('draft_search_idx')`)
    await db.execute(sql`ANALYZE draft`)
    return owner
  }

  test("reads only this user's drafts off an index, never the whole table", async ({
    db,
  }) => {
    const owner = await seedMany(db)

    const text = await explain(
      db,
      listDraftsQuery(db, { userId: owner.id, query: "quok" })
    )

    // Postgres picks the user's B-tree or the search index, by the numbers;
    // both start from this user's rows.
    expect(text).toMatch(/Index Cond: \(+user_id = /)
    expect(text).not.toContain("Seq Scan")
  })

  test("finds a rare match through the search index", async ({ db }) => {
    const owner = await seedMany(db)

    const text = await explain(
      db,
      listDraftsQuery(db, { userId: owner.id, query: "quokka systems" })
    )

    expect(text).toMatch(/Bitmap Index Scan on draft_search_idx/)
    expect(text).not.toContain("Seq Scan")
  })

  test("keeps the user in the search index, so a search skips other users' matches", async ({
    db,
  }) => {
    const [index] = (
      await db.execute<{ indexdef: string }>(
        sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'draft_search_idx'`
      )
    ).rows

    expect(index?.indexdef).toContain("USING gin (user_id, search)")
  })
})

describe("duplicateDraft", () => {
  test("copies the agreement, the answers and the status under a new title", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const original = await createDraft(db, {
      userId: owner.id,
      ...nda,
      fields: { purpose: "Resale" },
    })
    await updateDraft(
      db,
      { id: original.id, userId: owner.id },
      { status: "complete" }
    )

    const copy = await duplicateDraft(
      db,
      { id: original.id, userId: owner.id },
      { title: "NDA with Bolt (copy)" }
    )

    expect(copy).toMatchObject({
      userId: owner.id,
      documentId: "mutual-nda",
      title: "NDA with Bolt (copy)",
      fields: { purpose: "Resale" },
      status: "complete",
      firstExportedAt: null,
    })
    expect(copy?.id).not.toBe(original.id)
  })

  test("leaves the chat behind", async ({ db }) => {
    const owner = await makeUser(db)
    const original = await createDraft(db, { userId: owner.id, ...nda })
    await db.insert(message).values({
      id: "m-dup",
      draftId: original.id,
      role: "user",
      parts: [{ type: "text", text: "Hi" }],
    })

    const copy = await duplicateDraft(
      db,
      { id: original.id, userId: owner.id },
      { title: "Copy" }
    )

    expect(
      await db.select().from(message).where(eq(message.draftId, copy!.id))
    ).toEqual([])
  })

  test("can't copy another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const other = await makeUser(db)
    const original = await createDraft(db, { userId: owner.id, ...nda })

    expect(
      await duplicateDraft(
        db,
        { id: original.id, userId: other.id },
        { title: "Taken" }
      )
    ).toBeUndefined()
    expect(await listDrafts(db, { userId: other.id })).toEqual([])
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

describe("withinDraftLimit", () => {
  test("makes the draft while the user has fewer than the limit", async ({
    db,
  }) => {
    const guest = await makeUser(db, { isAnonymous: true })

    const made = await withinDraftLimit(
      db,
      { userId: guest.id, max: 1 },
      (tx) => createDraft(tx, { userId: guest.id, ...nda })
    )

    expect(made?.made.title).toBe(nda.title)
  })

  test("makes nothing once the user has the limit", async ({ db }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    await createDraft(db, { userId: guest.id, ...nda })

    const made = await withinDraftLimit(
      db,
      { userId: guest.id, max: 1 },
      (tx) => createDraft(tx, { userId: guest.id, ...nda })
    )

    expect(made).toBeUndefined()
    expect(
      await db.select().from(draft).where(eq(draft.userId, guest.id))
    ).toHaveLength(1)
  })

  test("counts only the user's own drafts", async ({ db }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    const other = await makeUser(db, { isAnonymous: true })
    await createDraft(db, { userId: other.id, ...nda })

    const made = await withinDraftLimit(
      db,
      { userId: guest.id, max: 1 },
      (tx) => createDraft(tx, { userId: guest.id, ...nda })
    )

    expect(made).toBeDefined()
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

  test("starts a draft before its document is chosen, still searchable", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const created = await createDraft(db, {
      userId: owner.id,
      documentId: null,
      title: "Roadmap with a vendor",
    })
    const found = await db
      .select({ id: draft.id })
      .from(draft)
      .where(sql`${draft.search} @@ to_tsquery('simple', 'vendor')`)

    expect(created.documentId).toBeNull()
    expect(found.map((row) => row.id)).toEqual([created.id])
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
