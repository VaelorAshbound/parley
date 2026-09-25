import { eq } from "drizzle-orm"
import { describe, expect } from "vite-plus/test"

import { createDraft, getDraft, listDrafts } from "../src/queries/drafts.ts"
import { moveGuestData } from "../src/queries/guests.ts"
import { listMessages, saveMessages } from "../src/queries/messages.ts"
import { aiUsage } from "../src/schema.ts"
import { makeUser, test } from "./db.ts"

const nda = { documentId: "mutual-nda", title: "NDA with Bolt" } as const
const hello = {
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "An NDA with Bolt" }],
} as const

describe("moveGuestData", () => {
  test("gives the guest's drafts and chat to the account", async ({ db }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    const account = await makeUser(db)
    const draft = await createDraft(db, { userId: guest.id, ...nda })
    await saveMessages(db, { id: draft.id, userId: guest.id }, [hello])

    const moved = await moveGuestData(db, { from: guest.id, to: account.id })

    expect(moved).toEqual({ drafts: 1 })
    const key = { id: draft.id, userId: account.id }
    expect(await getDraft(db, key)).toMatchObject({ title: "NDA with Bolt" })
    expect(await listMessages(db, key)).toEqual([hello])
    expect(await listDrafts(db, { userId: guest.id })).toEqual([])
  })

  test("keeps the draft's last-changed time (a move is not an edit)", async ({
    db,
  }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    const account = await makeUser(db)
    const draft = await createDraft(db, { userId: guest.id, ...nda })

    await moveGuestData(db, { from: guest.id, to: account.id })

    const after = await getDraft(db, { id: draft.id, userId: account.id })
    expect(after?.updatedAt).toEqual(draft.updatedAt)
  })

  test("keeps the account's own drafts", async ({ db }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    const account = await makeUser(db)
    await createDraft(db, { userId: account.id, ...nda, title: "Older" })
    await createDraft(db, { userId: guest.id, ...nda })

    await moveGuestData(db, { from: guest.id, to: account.id })

    const titles = (await listDrafts(db, { userId: account.id })).map(
      (row) => row.title
    )
    expect(titles.toSorted()).toEqual(["NDA with Bolt", "Older"])
  })

  test("adds the guest's AI usage to the account's, day by day", async ({
    db,
  }) => {
    const guest = await makeUser(db, { isAnonymous: true })
    const account = await makeUser(db)
    const usage = {
      messages: 3,
      inputTokens: 100,
      outputTokens: 50,
      costMicroUsd: 40,
    }
    await db.insert(aiUsage).values([
      { userId: guest.id, day: "2026-09-24", ...usage },
      { userId: guest.id, day: "2026-09-25", ...usage },
      { userId: account.id, day: "2026-09-25", ...usage },
    ])

    await moveGuestData(db, { from: guest.id, to: account.id })

    const rows = await db
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.userId, account.id))
      .orderBy(aiUsage.day)
    expect(rows).toEqual([
      { userId: account.id, day: "2026-09-24", ...usage },
      {
        userId: account.id,
        day: "2026-09-25",
        messages: 6,
        inputTokens: 200,
        outputTokens: 100,
        costMicroUsd: 80,
      },
    ])
  })

  test("never moves anything away from a real account", async ({ db }) => {
    const victim = await makeUser(db)
    const attacker = await makeUser(db)
    const draft = await createDraft(db, { userId: victim.id, ...nda })
    await db
      .insert(aiUsage)
      .values({ userId: victim.id, day: "2026-09-25", messages: 1 })

    const moved = await moveGuestData(db, {
      from: victim.id,
      to: attacker.id,
    })

    expect(moved).toEqual({ drafts: 0 })
    expect(
      await getDraft(db, { id: draft.id, userId: victim.id })
    ).toBeDefined()
    expect(
      await db.select().from(aiUsage).where(eq(aiUsage.userId, attacker.id))
    ).toEqual([])
  })
})
