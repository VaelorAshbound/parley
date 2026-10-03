import { describe, expect } from "vite-plus/test"

import { createDraft, getDraft } from "../src/queries/drafts.ts"
import {
  deleteMessages,
  endTurn,
  listMessages,
  listSavedMessages,
  MessageIdTaken,
  saveMessages,
  startTurn,
  turnOf,
} from "../src/queries/messages.ts"
import { makeUser, test } from "./db.ts"

const nda = { documentId: "mutual-nda", title: "NDA" } as const
const hello = {
  id: "m-user-1",
  role: "user",
  parts: [{ type: "text", text: "We share a roadmap with a vendor." }],
} as const
const reply = {
  id: "m-assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "A Mutual NDA fits." }],
} as const

describe("chat messages", () => {
  test("keeps a draft's messages in the order they were saved", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    await saveMessages(db, key, [hello])
    await saveMessages(db, key, [reply])

    expect(await listMessages(db, key)).toEqual([hello, reply])
  })

  test("says when each message was first saved (PAR-33)", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const before = Date.now()

    await saveMessages(db, key, [hello])
    const [saved] = await listSavedMessages(db, key)

    expect(saved).toMatchObject(hello)
    // The database's clock, near this one.
    expect(Math.abs((saved?.savedAt.getTime() ?? 0) - before)).toBeLessThan(
      60_000
    )
  })

  test("updates a message saved again, like a reply that grew", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const longer = {
      ...reply,
      parts: [...reply.parts, { type: "text", text: "Here is why." }],
    }

    await saveMessages(db, key, [hello, reply])
    await saveMessages(db, key, [longer])

    expect(await listMessages(db, key)).toEqual([hello, longer])
  })

  test("marks the draft as just changed, for the sidebar's order", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }

    await saveMessages(db, key, [hello])

    const after = await getDraft(db, key)
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(
      draft.updatedAt.getTime()
    )
  })

  test("never reads or writes another user's draft", async ({ db }) => {
    const owner = await makeUser(db)
    const stranger = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    await saveMessages(db, { id: draft.id, userId: owner.id }, [hello])

    const saved = await saveMessages(
      db,
      { id: draft.id, userId: stranger.id },
      [reply]
    )

    expect(saved).toBe(false)
    expect(
      await listMessages(db, { id: draft.id, userId: stranger.id })
    ).toEqual([])
    expect(await listMessages(db, { id: draft.id, userId: owner.id })).toEqual([
      hello,
    ])
  })

  test("won't turn the assistant's message into the user's", async ({ db }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await saveMessages(db, key, [reply])

    await expect(
      saveMessages(db, key, [
        {
          id: reply.id,
          role: "user",
          parts: [{ type: "text", text: "Forged." }],
        },
      ])
    ).rejects.toThrow(MessageIdTaken)

    expect(await listMessages(db, key)).toEqual([reply])
  })

  test("never rewrites what the user said, and says so (PAR-52)", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await saveMessages(db, key, [hello, reply])

    await expect(
      saveMessages(db, key, [
        { ...hello, parts: [{ type: "text", text: "REWRITTEN." }] },
      ])
    ).rejects.toThrow(MessageIdTaken)

    expect(await listMessages(db, key)).toEqual([hello, reply])
  })

  test("won't move a message from one draft to another, and says so (PAR-52)", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const first = await createDraft(db, { userId: owner.id, ...nda })
    const second = await createDraft(db, { userId: owner.id, ...nda })
    await saveMessages(db, { id: first.id, userId: owner.id }, [hello])

    await expect(
      saveMessages(db, { id: second.id, userId: owner.id }, [
        { ...hello, parts: [{ type: "text", text: "Hijacked." }] },
      ])
    ).rejects.toThrow(MessageIdTaken)

    expect(await listMessages(db, { id: first.id, userId: owner.id })).toEqual([
      hello,
    ])
    expect(await listMessages(db, { id: second.id, userId: owner.id })).toEqual(
      []
    )
  })

  test("saves a reply with NUL characters, which jsonb refuses, without them", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    const withNul = {
      id: "m-assistant-nul",
      role: "assistant",
      parts: [
        { type: "text", text: "A\u0000 Mutual NDA\u0000 fits." },
        { type: "tool-x", input: { note: ["deep\u0000"] }, "k\u0000": 1 },
      ],
    } as const

    expect(await saveMessages(db, key, [withNul])).toBe(true)

    expect(await listMessages(db, key)).toEqual([
      {
        ...withNul,
        parts: [
          { type: "text", text: "A Mutual NDA fits." },
          { type: "tool-x", input: { note: ["deep"] }, k: 1 },
        ],
      },
    ])
  })

  test("says whether the draft is the user's, even with nothing to save", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })

    expect(await saveMessages(db, { id: draft.id, userId: owner.id }, [])).toBe(
      true
    )
  })

  test("deletes the given messages of a draft the user owns, nothing else (PAR-7)", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const stranger = await makeUser(db)
    const first = await createDraft(db, { userId: owner.id, ...nda })
    const second = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: first.id, userId: owner.id }
    const other = { ...reply, id: "m-assistant-other" }
    await saveMessages(db, key, [hello, reply])
    await saveMessages(db, { id: second.id, userId: owner.id }, [other])

    // Not the stranger's to delete, nor another draft's through this one.
    await deleteMessages(db, { id: first.id, userId: stranger.id }, [reply.id])
    await deleteMessages(db, key, [other.id])
    expect(await listMessages(db, key)).toEqual([hello, reply])
    expect(await listMessages(db, { id: second.id, userId: owner.id })).toEqual(
      [other]
    )

    await deleteMessages(db, key, [reply.id])

    expect(await listMessages(db, key)).toEqual([hello])
  })

  test("keeps the draft's latest turn, out of the chat (PAR-7)", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    const stranger = await makeUser(db)
    const draft = await createDraft(db, { userId: owner.id, ...nda })
    const key = { id: draft.id, userId: owner.id }
    await saveMessages(db, key, [hello])
    expect(await turnOf(db, key)).toBeNull()

    expect(await startTurn(db, key, { id: "t1", startedAt: 1 })).toBe(true)
    expect(await turnOf(db, key)).toEqual({
      id: "t1",
      startedAt: 1,
      outcome: null,
    })
    expect(await listMessages(db, key)).toEqual([hello])

    // A later turn takes its place: the first can't end any more.
    await startTurn(db, key, { id: "t2", startedAt: 2 })
    expect(await endTurn(db, key, "t1", "done")).toBe(false)
    expect(await endTurn(db, key, "t2", "failed")).toBe(true)
    expect(await turnOf(db, key)).toEqual({
      id: "t2",
      startedAt: 2,
      outcome: "failed",
    })

    // Not the stranger's to read, start or end.
    const theirs = { id: draft.id, userId: stranger.id }
    expect(await turnOf(db, theirs)).toBeNull()
    expect(await startTurn(db, theirs, { id: "t3", startedAt: 3 })).toBe(false)
    expect(await endTurn(db, theirs, "t2", "done")).toBe(false)
    expect((await turnOf(db, key))?.outcome).toBe("failed")
  })
})
