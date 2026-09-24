import { ORPCError, safe } from "@orpc/client"
import { describe, expect, it } from "vitest"

import { router } from "../../web/src/server/rpc/router"
import { serverClient, signInGuest } from "./helpers"

// Every procedure × every kind of caller gets exactly the allowed result
// (spec §6 Auth matrix). A new procedure fails the completeness test below
// until it has a row here. T21 adds signed-up users, T26 Pro.

type Caller = "nobody" | "otherGuest" | "owner"
type Outcome = "OK" | "UNAUTHORIZED" | "NOT_FOUND"
type Client = Awaited<ReturnType<typeof serverClient>>

const today = "2026-09-24"

const matrix: Record<
  string,
  {
    run: (client: Client, draftId: string) => Promise<unknown>
    expect: Record<Caller, Outcome>
  }
> = {
  "drafts.create": {
    run: (client) => client.drafts.create({ documentId: "mutual-nda", today }),
    expect: { nobody: "UNAUTHORIZED", otherGuest: "OK", owner: "OK" },
  },
  "drafts.get": {
    run: (client, id) => client.drafts.get({ id }),
    expect: { nobody: "UNAUTHORIZED", otherGuest: "NOT_FOUND", owner: "OK" },
  },
  "drafts.updateFields": {
    run: (client, id) =>
      client.drafts.updateFields({
        id,
        changes: [{ key: "purpose", value: "Matrix test" }],
      }),
    expect: { nobody: "UNAUTHORIZED", otherGuest: "NOT_FOUND", owner: "OK" },
  },
}

describe("the auth matrix", async () => {
  const owner = await signInGuest()
  const ownerClient = await serverClient(owner.cookie)
  const draft = await ownerClient.drafts.create({
    documentId: "mutual-nda",
    today,
  })
  const clients: Record<Caller, Client> = {
    nobody: await serverClient(),
    otherGuest: await serverClient((await signInGuest()).cookie),
    owner: ownerClient,
  }

  describe.each(Object.entries(matrix))("%s", (_, row) => {
    it.each(Object.entries(row.expect))("%s → %s", async (caller, outcome) => {
      const { error } = await safe(row.run(clients[caller as Caller], draft.id))

      const got =
        error === null ? "OK" : error instanceof ORPCError ? error.code : error
      expect(got).toBe(outcome)
    })
  })

  it("covers every procedure in the router", () => {
    const procedures = Object.entries(router).flatMap(([group, procedures]) =>
      Object.keys(procedures).map((name) => `${group}.${name}`)
    )

    expect(Object.keys(matrix).toSorted()).toEqual(procedures.toSorted())
  })
})
