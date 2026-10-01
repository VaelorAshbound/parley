import { ORPCError, safe } from "@orpc/client"
import type { RouterClient } from "@orpc/server"
import { schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Router } from "../../web/src/server/rpc/router"
import {
  browserClient,
  call,
  database,
  signInGuest,
  signUpVerified,
} from "./helpers"

// Read-only share links (spec §2, T25) through the real /api app and a real
// Postgres. A link shows the draft's document to anyone who has it, and
// nothing else: not the chat, not the owner, not their other drafts.

const today = "2026-09-25"

type Client = RouterClient<Router>

function codeOf(error: unknown) {
  return error instanceof ORPCError ? error.code : error
}

/** A signed-up owner with a confirmed email, and a Mutual NDA they wrote. */
async function ownerWithDraft() {
  const account = await signUpVerified()
  const client = browserClient(account.cookie)
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  await client.drafts.updateFields({
    id: draft.id,
    changes: [{ key: "purpose", value: "Talks about a new roadmap" }],
  })
  await client.drafts.rename({ id: draft.id, title: "NDA with Bolt" })
  return { ...account, client, draftId: draft.id }
}

/** share.view as a stranger's browser sends it: no cookie. */
function viewOverHttp(token: string) {
  return call("/api/rpc/share/view", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
    body: JSON.stringify({ json: { token } }),
  })
}

const anyone = () => browserClient("")

afterEach(() => vi.restoreAllMocks())

describe("share.create", () => {
  it("gives a link of 128 random bits", async () => {
    const { client, draftId } = await ownerWithDraft()

    const { token } = await client.share.create({ id: draftId })

    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it("gives the same link again while it is on", async () => {
    const { client, draftId } = await ownerWithDraft()

    const first = await client.share.create({ id: draftId })
    const second = await client.share.create({ id: draftId })

    expect(second.token).toBe(first.token)
  })

  it("refuses a draft with no agreement yet", async () => {
    const { client } = await ownerWithDraft()
    const empty = await client.drafts.create({ today })

    const { error } = await safe(client.share.create({ id: empty.id }))

    expect(codeOf(error)).toBe("NO_DOCUMENT")
  })

  it("asks a guest to sign up first", async () => {
    const guest = browserClient((await signInGuest()).cookie)
    const draft = await guest.drafts.create({ documentId: "mutual-nda", today })

    const { error } = await safe(guest.share.create({ id: draft.id }))

    expect(codeOf(error)).toBe("UNAUTHORIZED")
  })
})

describe("share.get", () => {
  it("gives the link that is on, or null", async () => {
    const { client, draftId } = await ownerWithDraft()

    expect(await client.share.get({ id: draftId })).toBeNull()
    const link = await client.share.create({ id: draftId })
    expect(await client.share.get({ id: draftId })).toEqual(link)
    await client.share.revoke({ id: draftId })
    expect(await client.share.get({ id: draftId })).toBeNull()
  })
})

describe("share.view", () => {
  it("shows anyone the document: title, agreement and values", async () => {
    const { client, draftId } = await ownerWithDraft()
    const { token } = await client.share.create({ id: draftId })

    const shared = await anyone().share.view({ token })

    expect(shared.title).toBe("NDA with Bolt")
    expect(shared.documentId).toBe("mutual-nda")
    expect(shared.values).toMatchObject({
      purpose: "Talks about a new roadmap",
    })
    expect(Object.keys(shared).toSorted()).toEqual([
      "documentId",
      "title",
      "values",
    ])
  })

  it("never sends the chat, the owner or the draft's id", async () => {
    const { client, draftId, email } = await ownerWithDraft()
    const db = await database()
    await db.insert(schema.message).values({
      id: crypto.randomUUID(),
      draftId,
      role: "user",
      parts: [{ type: "text", text: "secret chat about the price" }],
    })
    const [owner] = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    const { token } = await client.share.create({ id: draftId })

    const response = await viewOverHttp(token)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain("Talks about a new roadmap")
    for (const secret of [
      "secret chat",
      email,
      owner?.id ?? "no owner",
      draftId,
    ])
      expect(body).not.toContain(secret)
  })

  it("answers a turned-off link with not found, at once", async () => {
    const { client, draftId } = await ownerWithDraft()
    const { token } = await client.share.create({ id: draftId })

    await client.share.revoke({ id: draftId })
    const response = await viewOverHttp(token)

    expect(response.status).toBe(404)
    const { error } = await safe(anyone().share.view({ token }))
    expect(codeOf(error)).toBe("NOT_FOUND")
  })

  it("keeps a turned-off link off when a new one is made", async () => {
    const { client, draftId } = await ownerWithDraft()
    const old = await client.share.create({ id: draftId })
    await client.share.revoke({ id: draftId })

    const fresh = await client.share.create({ id: draftId })

    expect(fresh.token).not.toBe(old.token)
    expect(await anyone().share.view({ token: fresh.token })).toBeDefined()
    const { error } = await safe(anyone().share.view({ token: old.token }))
    expect(codeOf(error)).toBe("NOT_FOUND")
  })

  it("answers an unknown token with not found", async () => {
    const { error } = await safe(
      anyone().share.view({ token: "AAAAAAAAAAAAAAAAAAAAAA" })
    )

    expect(codeOf(error)).toBe("NOT_FOUND")
  })

  it("turns away a token that isn't one before the database", async () => {
    for (const token of ["short", "A".repeat(23), "AAAAAAAAAAAAAAAAAAAA%'"]) {
      const { error } = await safe(anyone().share.view({ token }))
      expect(codeOf(error)).toBe("BAD_REQUEST")
    }
  })

  it("stops working when the draft is deleted", async () => {
    const { client, draftId } = await ownerWithDraft()
    const { token } = await client.share.create({ id: draftId })

    await client.drafts.delete({ id: draftId })

    const { error } = await safe(anyone().share.view({ token }))
    expect(codeOf(error)).toBe("NOT_FOUND")
  })

  it("shows the draft as it is now, not as it was shared", async () => {
    const { client, draftId } = await ownerWithDraft()
    const { token } = await client.share.create({ id: draftId })

    await client.drafts.updateFields({
      id: draftId,
      changes: [{ key: "purpose", value: "A changed purpose" }],
    })

    expect((await anyone().share.view({ token })).values).toMatchObject({
      purpose: "A changed purpose",
    })
  })
})

describe("share.revoke", () => {
  it("leaves the link on when someone else tries", async () => {
    const { client, draftId } = await ownerWithDraft()
    const { token } = await client.share.create({ id: draftId })
    const other: Client = browserClient((await signUpVerified()).cookie)

    const { error } = await safe(other.share.revoke({ id: draftId }))

    expect(codeOf(error)).toBe("NOT_FOUND")
    expect(await anyone().share.view({ token })).toBeDefined()
  })
})

describe("the logs", () => {
  it("say who shared and turned off which draft, never the token", async () => {
    const { client, draftId } = await ownerWithDraft()
    const logged = vi.spyOn(console, "log").mockImplementation(() => {})

    const { token } = await client.share.create({ id: draftId })
    await anyone().share.view({ token })
    await client.share.revoke({ id: draftId })
    await safe(anyone().share.view({ token }))

    const lines = logged.mock.calls.map(
      ([line]) => line as Record<string, unknown>
    )
    const events = lines.filter((line) =>
      String(line.event).startsWith("share")
    )
    expect(events).toEqual([
      expect.objectContaining({
        event: "share_created",
        draftId,
        userId: expect.any(String),
      }),
      expect.objectContaining({ event: "share_viewed", outcome: "found" }),
      expect.objectContaining({
        event: "share_revoked",
        draftId,
        userId: expect.any(String),
        revoked: 1,
      }),
      expect.objectContaining({ event: "share_viewed", outcome: "not_found" }),
    ])
    expect(JSON.stringify(logged.mock.calls)).not.toContain(token)
  })
})
