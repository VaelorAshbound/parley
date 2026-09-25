import { connect, listMessages, saveMessages, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { env } from "cloudflare:workers"
import { describe, expect, it, onTestFinished } from "vitest"

import { call, cookiesFrom, serverClient, signInGuest } from "./helpers"

// A guest who signs up or signs in keeps their draft and chat (spec §1
// story 6). Better Auth deletes the guest after it links, and drafts cascade
// with it, so onLinkAccount must move them first (T14 review).

const today = "2026-09-25"
const hello = {
  id: "m-hello",
  role: "user" as const,
  parts: [{ type: "text", text: "An NDA with Bolt" }],
}

async function database() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  return db
}

/** A guest with one draft and one chat message. */
async function guestWithDraft() {
  const guest = await signInGuest()
  const client = await serverClient(guest.cookie)
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  const db = await database()
  await saveMessages(db, { id: draft.id, userId: draft.userId }, [hello])
  return { ...guest, draft }
}

function newEmail() {
  return `ana-${crypto.randomUUID()}@example.test`
}

async function signUp(email: string, cookie?: string) {
  return call("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify({ name: "Ana", email, password: "correct horse 1" }),
  })
}

async function signIn(email: string, cookie?: string) {
  return call("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify({ email, password: "correct horse 1" }),
  })
}

describe("a guest who signs up", () => {
  it("keeps their draft and its chat", async () => {
    const guest = await guestWithDraft()

    const response = await signUp(newEmail(), guest.cookie)

    expect(response.status).toBe(200)
    const account = await serverClient(cookiesFrom(response))
    const draft = await account.drafts.get({ id: guest.draft.id })
    expect(draft).toMatchObject({
      id: guest.draft.id,
      title: guest.draft.title,
      fields: guest.draft.fields,
    })
    expect(draft.userId).not.toBe(guest.draft.userId)
    const db = await database()
    expect(
      await listMessages(db, { id: guest.draft.id, userId: draft.userId })
    ).toEqual([hello])
  })

  it("leaves no guest behind", async () => {
    const guest = await guestWithDraft()

    await signUp(newEmail(), guest.cookie)

    const db = await database()
    const rows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, guest.draft.userId))
    expect(rows).toEqual([])
  })

  it("doesn't let the old guest cookie reach the draft", async () => {
    const guest = await guestWithDraft()

    await signUp(newEmail(), guest.cookie)

    // The session cookie cache may still name the guest for up to 5 minutes
    // (spec §5 Auth), but the draft is the account's now.
    await expect(
      (await serverClient(guest.cookie)).drafts.get({ id: guest.draft.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("a guest who signs in to an existing account", () => {
  it("adds the guest's draft to the account's drafts", async () => {
    const email = newEmail()
    const existing = await signUp(email)
    const owner = await serverClient(cookiesFrom(existing))
    const older = await owner.drafts.create({ documentId: "mutual-nda", today })
    const guest = await guestWithDraft()

    const response = await signIn(email, guest.cookie)

    expect(response.status).toBe(200)
    const account = await serverClient(cookiesFrom(response))
    const ids = (await account.drafts.list({})).map((draft) => draft.id)
    expect(ids.toSorted()).toEqual([older.id, guest.draft.id].toSorted())
  })

  it("moves nothing when the password is wrong", async () => {
    const email = newEmail()
    await signUp(email)
    const guest = await guestWithDraft()

    const response = await call("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: guest.cookie },
      body: JSON.stringify({ email, password: "wrong password 1" }),
    })

    expect(response.status).toBe(401)
    const stillGuest = await serverClient(guest.cookie)
    expect(await stillGuest.drafts.get({ id: guest.draft.id })).toMatchObject({
      id: guest.draft.id,
    })
  })
})
