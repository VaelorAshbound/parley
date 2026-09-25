import { ORPCError, safe } from "@orpc/client"
import { describe, expect, it } from "vitest"

import { router } from "../../web/src/server/rpc/router"
import {
  serverClient,
  signInGuest,
  signUpUser,
  signUpVerified,
} from "./helpers"

// Every procedure × every kind of caller gets exactly the allowed result
// (spec §6 Auth matrix). A new procedure fails the completeness test below
// until it has a row here. Owners and others are guests, signed-up
// accounts (T21) and accounts with a confirmed email (T24); T26 adds Pro.
// Settings (T23) are for accounts only.

type Caller =
  | "nobody"
  | "otherGuest"
  | "otherAccount"
  | "verifiedOther"
  | "owner"
  | "accountOwner"
  | "verifiedOwner"
type Outcome =
  | "OK"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_OPEN"
  | "PASSWORD_ALREADY_SET"
  | "EMAIL_NOT_VERIFIED"
  | "INCOMPLETE"
  | "PRO_REQUIRED"
type Client = Awaited<ReturnType<typeof serverClient>>

const today = "2026-09-24"

/** The usual row: signed-in owners may, everyone else may not. */
const ownersOnly = {
  nobody: "UNAUTHORIZED",
  otherGuest: "NOT_FOUND",
  otherAccount: "NOT_FOUND",
  verifiedOther: "NOT_FOUND",
  owner: "OK",
  accountOwner: "OK",
  verifiedOwner: "OK",
} as const satisfies Record<Caller, Outcome>

/**
 * Exports: a confirmed email first (guests sign up), then the draft's
 * owner. The owners' drafts are empty, so they get past both and stop at
 * the content.
 */
const verifiedOwnersOnly = {
  nobody: "UNAUTHORIZED",
  otherGuest: "UNAUTHORIZED",
  otherAccount: "EMAIL_NOT_VERIFIED",
  verifiedOther: "NOT_FOUND",
  owner: "UNAUTHORIZED",
  accountOwner: "EMAIL_NOT_VERIFIED",
  verifiedOwner: "INCOMPLETE",
} as const satisfies Record<Caller, Outcome>

/** Anyone signed in, guest or account. */
const signedIn = {
  nobody: "UNAUTHORIZED",
  otherGuest: "OK",
  otherAccount: "OK",
  verifiedOther: "OK",
  owner: "OK",
  accountOwner: "OK",
  verifiedOwner: "OK",
} as const satisfies Record<Caller, Outcome>

/** Everyone, signed in or not: a share link's page (T25). */
const anyone = {
  nobody: "OK",
  otherGuest: "OK",
  otherAccount: "OK",
  verifiedOther: "OK",
  owner: "OK",
  accountOwner: "OK",
  verifiedOwner: "OK",
} as const satisfies Record<Caller, Outcome>

/** A link the confirmed owner made, for share.view (set up below). */
let sharedToken = ""

/** Signed-up accounts only: settings (T23). The owner here is a guest. */
const accountsOnly = {
  nobody: "UNAUTHORIZED",
  otherGuest: "UNAUTHORIZED",
  otherAccount: "OK",
  verifiedOther: "OK",
  owner: "UNAUTHORIZED",
  accountOwner: "OK",
  verifiedOwner: "OK",
} as const satisfies Record<Caller, Outcome>

const matrix: Record<
  string,
  {
    run: (client: Client, draftId: string) => Promise<unknown>
    expect: Record<Caller, Outcome>
  }
> = {
  "drafts.create": {
    run: (client) => client.drafts.create({ documentId: "mutual-nda", today }),
    expect: signedIn,
  },
  "drafts.list": {
    run: (client) => client.drafts.list({}),
    expect: signedIn,
  },
  "drafts.get": {
    run: (client, id) => client.drafts.get({ id }),
    expect: ownersOnly,
  },
  "chat.messages": {
    run: (client, id) => client.chat.messages({ id }),
    expect: ownersOnly,
  },
  "chat.send": {
    run: (client, id) =>
      client.chat.send({
        id,
        message: {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: "Matrix test" }],
        },
        today,
      }),
    expect: ownersOnly,
  },
  "drafts.chooseDocument": {
    run: (client, id) =>
      client.drafts.chooseDocument({ id, documentId: "mutual-nda", today }),
    expect: ownersOnly,
  },
  "drafts.updateFields": {
    run: (client, id) =>
      client.drafts.updateFields({
        id,
        changes: [{ key: "purpose", value: "Matrix test" }],
      }),
    expect: ownersOnly,
  },
  "chat.answer": {
    run: (client, id) =>
      client.chat.answer({
        id,
        calls: [{ toolCallId: "call-1-0", answers: { term: ["1y"] } }],
        today,
      }),
    // Owners get past the owner check; the draft asked nothing.
    expect: {
      ...ownersOnly,
      owner: "NOT_OPEN",
      accountOwner: "NOT_OPEN",
      verifiedOwner: "NOT_OPEN",
    },
  },
  "drafts.markComplete": {
    run: (client, id) => client.drafts.markComplete({ id }),
    expect: ownersOnly,
  },
  "account.get": {
    run: (client) => client.account.get(),
    expect: accountsOnly,
  },
  "account.sessions": {
    run: (client) => client.account.sessions(),
    expect: accountsOnly,
  },
  "account.revokeSession": {
    run: (client) => client.account.revokeSession({ id: "no-such-session" }),
    // Accounts get past the check; the session isn't theirs.
    expect: {
      ...accountsOnly,
      otherAccount: "NOT_FOUND",
      verifiedOther: "NOT_FOUND",
      accountOwner: "NOT_FOUND",
      verifiedOwner: "NOT_FOUND",
    },
  },
  "account.setPassword": {
    run: (client) =>
      client.account.setPassword({ newPassword: "matrix password 1" }),
    // Accounts get past the check; they signed up with a password.
    expect: {
      ...accountsOnly,
      otherAccount: "PASSWORD_ALREADY_SET",
      verifiedOther: "PASSWORD_ALREADY_SET",
      accountOwner: "PASSWORD_ALREADY_SET",
      verifiedOwner: "PASSWORD_ALREADY_SET",
    },
  },
  "export.pdf": {
    run: (client, id) => client.export.pdf({ id }),
    expect: verifiedOwnersOnly,
  },
  "export.docx": {
    run: (client, id) => client.export.docx({ id }),
    // Word files are for Pro, whatever the draft holds.
    expect: { ...verifiedOwnersOnly, verifiedOwner: "PRO_REQUIRED" },
  },
  "drafts.rename": {
    run: (client, id) => client.drafts.rename({ id, title: "Matrix test" }),
    expect: ownersOnly,
  },
  "drafts.duplicate": {
    run: (client, id) => client.drafts.duplicate({ id }),
    expect: ownersOnly,
  },
  "share.get": {
    run: (client, id) => client.share.get({ id }),
    expect: ownersOnly,
  },
  "share.create": {
    run: (client, id) => client.share.create({ id }),
    // Like export, a confirmed email; an unfinished draft may be shared.
    expect: { ...verifiedOwnersOnly, verifiedOwner: "OK" },
  },
  "share.view": {
    run: (client) => client.share.view({ token: sharedToken }),
    expect: anyone,
  },
  // After share.view: the confirmed owner's link is off after it.
  "share.revoke": {
    run: (client, id) => client.share.revoke({ id }),
    expect: ownersOnly,
  },
  // Last: the owners' own drafts are gone after it.
  "drafts.delete": {
    run: (client, id) => client.drafts.delete({ id }),
    expect: ownersOnly,
  },
}

/** A caller with a draft of their own. */
async function withDraft(cookie: string) {
  const client = await serverClient(cookie)
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  return { client, draftId: draft.id }
}

describe("the auth matrix", async () => {
  const owner = await withDraft((await signInGuest()).cookie)
  const accountOwner = await withDraft((await signUpUser()).cookie)
  const verifiedOwner = await withDraft((await signUpVerified()).cookie)
  sharedToken = (
    await verifiedOwner.client.share.create({ id: verifiedOwner.draftId })
  ).token
  // Everyone else tries the guest owner's draft.
  const other = async (cookie?: string) => ({
    client: await serverClient(cookie),
    draftId: owner.draftId,
  })
  const callers: Record<Caller, { client: Client; draftId: string }> = {
    nobody: await other(),
    otherGuest: await other((await signInGuest()).cookie),
    otherAccount: await other((await signUpUser()).cookie),
    verifiedOther: await other((await signUpVerified()).cookie),
    owner,
    accountOwner,
    verifiedOwner,
  }

  describe.each(Object.entries(matrix))("%s", (_, row) => {
    it.each(Object.entries(row.expect))("%s → %s", async (caller, outcome) => {
      const { client, draftId } = callers[caller as Caller]
      const { error } = await safe(row.run(client, draftId))

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
