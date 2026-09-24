import { createORPCClient, safe } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins"
import type { RouterClient } from "@orpc/server"
import { connect, schema } from "@workspace/db"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"

import type { Router } from "../../web/src/server/rpc/router"
import { call, origin, signInGuest } from "./helpers"

/** The browser's client, over HTTP through the real /api app. */
function browserClient(cookie: string): RouterClient<Router> {
  return createORPCClient(
    new RPCLink({
      url: `${origin}/api/rpc`,
      headers: { cookie },
      plugins: [new SimpleCsrfProtectionLinkPlugin()],
      fetch: async (request) =>
        call(new URL(request.url).pathname + new URL(request.url).search, {
          method: request.method,
          headers: request.headers,
          body: request.method === "GET" ? null : await request.text(),
        }),
    })
  )
}

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
    const line = JSON.parse(String(logged.mock.calls[0]?.[0]))
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
