import { safe } from "@orpc/client"
import { connect, schema } from "@workspace/db"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"

import {
  browserClient,
  call,
  chatClient,
  scriptedModel,
  signInGuest,
  signUpUser,
} from "./helpers"

const today = "2026-09-24"

describe("drafts over /api/rpc", () => {
  it("starts a draft with the document's defaults and today's date", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    expect(draft).toMatchObject({
      documentId: "mutual-nda",
      title: "Mutual Non-Disclosure Agreement",
      status: "drafting",
      fields: { effectiveDate: today },
    })
    expect(draft.createdAt).toBeInstanceOf(Date)
    expect(await client.drafts.get({ id: draft.id })).toEqual(draft)
  })

  it("starts a draft before its agreement is chosen", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const draft = await client.drafts.create({ today })

    expect(draft).toMatchObject({
      documentId: null,
      title: "New draft",
      fields: {},
    })
  })

  it("won't take field changes before the agreement is chosen", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })

    const { error } = await safe(
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "purpose", value: "Hiring." }],
      })
    )

    expect(error).toMatchObject({ code: "NO_DOCUMENT", defined: true })
  })

  it("chooses the agreement: its defaults, its name, today's date", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })

    const chosen = await client.drafts.chooseDocument({
      id: draft.id,
      documentId: "mutual-nda",
      today,
    })

    expect(chosen).toMatchObject({
      documentId: "mutual-nda",
      title: "Mutual Non-Disclosure Agreement",
      fields: { effectiveDate: today },
    })
  })

  it("switching agreements keeps what fits, and a title the user chose", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ documentId: "csa", today })
    const provider = { company: "Acme Cloud, Inc." }
    await client.drafts.updateFields({
      id: draft.id,
      changes: [{ key: "provider", value: provider }],
    })

    const switched = await client.drafts.chooseDocument({
      id: draft.id,
      documentId: "sla",
      today,
    })

    expect(switched.documentId).toBe("sla")
    expect(switched.title).toBe("Service Level Agreement")
    expect(switched.fields).toMatchObject({ provider })
  })

  it("refuses an unknown document", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const { error } = await safe(
      // @ts-expect-error: not a catalog id
      client.drafts.create({ documentId: "will", today })
    )

    expect(error).toMatchObject({ code: "BAD_REQUEST" })
  })

  it("applies valid changes, returns the rejected ones and an undo", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const result = await client.drafts.updateFields({
      id: draft.id,
      changes: [
        { key: "purpose", value: "Evaluating a partnership." },
        { key: "noSuchField", value: "x" },
      ],
    })

    expect(result.draft.fields).toMatchObject({
      purpose: "Evaluating a partnership.",
    })
    expect(result.applied).toHaveLength(1)
    expect(result.rejected).toEqual([
      expect.objectContaining({ key: "noSuchField" }),
    ])

    const undone = await client.drafts.updateFields({
      id: draft.id,
      changes: result.inverse,
    })
    expect(undone.draft.fields).toEqual(draft.fields)
  })

  it("keeps both of two edits made at the same moment", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    await Promise.all([
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "purpose", value: "Edited by the AI." }],
      }),
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "modifications", value: "Edited by hand." }],
      }),
    ])

    expect((await client.drafts.get({ id: draft.id })).fields).toMatchObject({
      purpose: "Edited by the AI.",
      modifications: "Edited by hand.",
    })
  })

  it("doesn't save or bump the draft when every change is rejected", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const result = await client.drafts.updateFields({
      id: draft.id,
      changes: [{ key: "noSuchField", value: "x" }],
    })

    expect(result.applied).toEqual([])
    expect(result.draft.updatedAt).toEqual(draft.updatedAt)
  })

  it("refuses a malformed draft id before touching the database", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const { error } = await safe(client.drafts.get({ id: "1 OR 1=1" }))

    expect(error).toMatchObject({ code: "BAD_REQUEST" })
  })
})

/** The rest of a Mutual NDA, on top of its defaults. */
const ndaChanges = [
  { key: "purpose", value: "Evaluating a manufacturing partnership." },
  {
    key: "party1",
    value: {
      company: "Acme Robotics",
      name: "Ana Diaz",
      title: "CEO",
      email: "ana@acme.test",
    },
  },
  {
    key: "party2",
    value: {
      company: "Northwind Labs",
      name: "Bo Chen",
      title: "Head of Partnerships",
      email: "bo@northwind.test",
    },
  },
  { key: "governingLaw", value: { state: "DE", courtLocation: "New Castle" } },
]

describe("drafts.markComplete", () => {
  it("marks a finished draft complete", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.updateFields({ id: draft.id, changes: ndaChanges })

    const result = await client.drafts.markComplete({ id: draft.id })

    expect(result).toEqual({ complete: true, missing: [] })
    expect(await client.drafts.get({ id: draft.id })).toMatchObject({
      status: "complete",
    })
  })

  it("lists what is missing, with each field's label, and keeps drafting", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.updateFields({
      id: draft.id,
      changes: [{ key: "party1", value: { company: "Acme Robotics" } }],
    })

    const result = await client.drafts.markComplete({ id: draft.id })

    expect(result.complete).toBe(false)
    expect(result.missing).toContainEqual({
      key: "party1",
      label: "Party 1",
      path: ["name"],
      message: "Fill this in.",
    })
    expect(await client.drafts.get({ id: draft.id })).toMatchObject({
      status: "drafting",
    })
  })

  it("goes back to drafting when a change leaves the document unfinished", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.updateFields({ id: draft.id, changes: ndaChanges })
    await client.drafts.markComplete({ id: draft.id })

    await client.drafts.updateFields({
      id: draft.id,
      changes: [{ key: "party2", value: null }],
    })

    expect(await client.drafts.get({ id: draft.id })).toMatchObject({
      status: "drafting",
    })
  })

  it("goes back to drafting when the agreement is switched", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.updateFields({ id: draft.id, changes: ndaChanges })
    await client.drafts.markComplete({ id: draft.id })

    const switched = await client.drafts.chooseDocument({
      id: draft.id,
      documentId: "csa",
      today,
    })

    expect(switched.status).toBe("drafting")
  })

  it("won't finish a draft before its agreement is chosen", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })

    const { error } = await safe(client.drafts.markComplete({ id: draft.id }))

    expect(error).toMatchObject({ code: "NO_DOCUMENT" })
  })
})

// A guest keeps one draft (T27), so tests with more use an account.
describe("drafts.list", () => {
  it("lists only the caller's own drafts, last changed first", async () => {
    const mine = browserClient((await signUpUser()).cookie)
    const theirs = browserClient((await signInGuest()).cookie)
    const first = await mine.drafts.create({ documentId: "mutual-nda", today })
    const second = await mine.drafts.create({ documentId: "csa", today })
    await theirs.drafts.create({ documentId: "psa", today })
    await mine.drafts.updateFields({
      id: first.id,
      changes: [{ key: "purpose", value: "Touched last" }],
    })

    const listed = await mine.drafts.list({})

    expect(listed.map((draft) => draft.id)).toEqual([first.id, second.id])
  })

  it("searches titles, document types and party names from the start of each word", async () => {
    const client = browserClient((await signUpUser()).cookie)
    const nda = await client.drafts.create({ documentId: "mutual-nda", today })
    await client.drafts.create({ documentId: "csa", today })
    await client.drafts.updateFields({
      id: nda.id,
      changes: [{ key: "party2", value: { company: "Northwind Labs" } }],
    })

    const byParty = await client.drafts.list({ query: "north" })
    const byType = await client.drafts.list({ query: "Mutual nd" })

    expect(byParty.map((draft) => draft.id)).toEqual([nda.id])
    expect(byType.map((draft) => draft.id)).toEqual([nda.id])
  })

  it("filters by document type and goes on page by page", async () => {
    const client = browserClient((await signUpUser()).cookie)
    const ndas = [
      await client.drafts.create({ documentId: "mutual-nda", today }),
      await client.drafts.create({ documentId: "mutual-nda", today }),
      await client.drafts.create({ documentId: "mutual-nda", today }),
    ]
    await client.drafts.create({ documentId: "csa", today })

    const first = await client.drafts.list({
      documentId: "mutual-nda",
      limit: 2,
    })
    const next = await client.drafts.list({
      documentId: "mutual-nda",
      limit: 2,
      after: first.at(-1),
    })

    expect([...first, ...next].map((draft) => draft.id)).toEqual(
      ndas.map((draft) => draft.id).toReversed()
    )
  })

  it("refuses a search longer than a search box allows", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const { error } = await safe(client.drafts.list({ query: "a".repeat(101) }))

    expect(error).toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("drafts.rename", () => {
  it("saves the new title, trimmed", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const renamed = await client.drafts.rename({
      id: draft.id,
      title: "  NDA with Northwind  ",
    })

    expect(renamed.title).toBe("NDA with Northwind")
    expect((await client.drafts.get({ id: draft.id })).title).toBe(
      "NDA with Northwind"
    )
  })

  it("keeps the title when switching agreements after a rename", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.rename({ id: draft.id, title: "Northwind" })

    const switched = await client.drafts.chooseDocument({
      id: draft.id,
      documentId: "csa",
      today,
    })

    expect(switched.title).toBe("Northwind")
  })

  it.each([
    ["an empty title", "   "],
    ["a title over 100 characters", "a".repeat(101)],
  ])("refuses %s", async (_, title) => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const { error } = await safe(client.drafts.rename({ id: draft.id, title }))

    expect(error).toMatchObject({ code: "BAD_REQUEST" })
  })
})

// Guests can't copy (T27: one draft), so these use an account.
describe("drafts.duplicate", () => {
  it("makes a copy with the same answers, marked as a copy, first in the list", async () => {
    const client = browserClient((await signUpUser()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.updateFields({ id: draft.id, changes: ndaChanges })

    const copy = await client.drafts.duplicate({ id: draft.id })

    expect(copy).toMatchObject({
      documentId: "mutual-nda",
      title: "Mutual Non-Disclosure Agreement (copy)",
      fields: (await client.drafts.get({ id: draft.id })).fields,
    })
    expect(copy.id).not.toBe(draft.id)
    expect((await client.drafts.list({}))[0]?.id).toBe(copy.id)
  })

  it("starts the copy with an empty chat", async () => {
    const { client, settle } = await chatClient(
      (await signUpUser()).cookie,
      scriptedModel([[{ text: "Noted." }]])
    )
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    const stream = await client.chat.send({
      id: draft.id,
      message: {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      today,
    })
    for await (const _ of stream);
    await settle()
    expect(await client.chat.messages({ id: draft.id })).toHaveLength(2)

    const copy = await client.drafts.duplicate({ id: draft.id })

    expect(await client.chat.messages({ id: copy.id })).toEqual([])
  })

  it("keeps a long title within the limit", async () => {
    const client = browserClient((await signUpUser()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    await client.drafts.rename({ id: draft.id, title: "a".repeat(100) })

    const copy = await client.drafts.duplicate({ id: draft.id })

    expect(copy.title).toHaveLength(100)
    expect(copy.title.endsWith(" (copy)")).toBe(true)
  })
})

describe("drafts.delete", () => {
  it("deletes the draft: gone from the list and not found after", async () => {
    const client = browserClient((await signUpUser()).cookie)
    const kept = await client.drafts.create({ documentId: "csa", today })
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    await client.drafts.delete({ id: draft.id })

    expect((await client.drafts.list({})).map((each) => each.id)).toEqual([
      kept.id,
    ])
    const { error } = await safe(client.drafts.get({ id: draft.id }))
    expect(error).toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("an unexpected server error", () => {
  it("is logged with the request id and shown to the client without details", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    // A stored value the document's schema no longer accepts.
    const db = await connect(env.HYPERDRIVE.connectionString)
    await db
      .update(schema.draft)
      .set({ fields: { purpose: 42 } })
      .where(eq(schema.draft.id, draft.id))
    using logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const { error } = await safe(
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "purpose", value: "x" }],
      })
    )

    expect(error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    })
    const line = logged.mock.calls[0]?.[0]
    expect(line).toMatchObject({
      level: "error",
      event: "rpc_error",
      requestId: expect.any(String),
      error: { name: "ZodError" },
    })
  })
})

describe("the RPC endpoint's guards", () => {
  it("refuses a request without the CSRF header, as a form post would be", async () => {
    const { cookie } = await signInGuest()

    const response = await call("/api/rpc/drafts/create", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ json: { documentId: "mutual-nda", today } }),
    })

    expect(response.status).toBe(403)
  })

  it("refuses a body over 128 KB before reading it", async () => {
    const { cookie } = await signInGuest()

    const response = await call("/api/rpc/drafts/create", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-csrf-token": "orpc",
      },
      body: "x".repeat(128 * 1024 + 1),
    })

    expect(response.status).toBe(413)
  })
})
