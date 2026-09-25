import {
  activeShare,
  revokeShares,
  shareDraft,
  sharedDraft,
} from "@workspace/db"
import { definitionOf } from "@workspace/documents"

import { logInfo } from "../log"
import { z } from "../zod"
import { authed, draftOwner, pub, verified } from "./base"

// Read-only share links (spec §2, user story 9; T25). A link is a token of
// 128 random bits; whoever has it can read the draft's document at
// /s/:token, and nothing else: not the chat, the owner or other drafts.
// Making a link needs a confirmed email, like export (spec §2 Limits);
// turning one off only needs the draft to be yours, so it is never blocked.
// Hyperdrive's query cache is off, so a link turned off stops at once
// (spec §5 Database).

const draftId = z.object({ id: z.uuid() })

/** A token as shareDraft makes them; anything else never reaches the database. */
const token = z.string().regex(/^[A-Za-z0-9_-]{22}$/)

export const share = {
  /** The draft's link that is on, or null. */
  get: authed
    .input(draftId)
    .use(draftOwner, (input) => input.id)
    .handler(
      async ({ context, input }) =>
        (await activeShare(context.db, {
          id: input.id,
          userId: context.user.id,
        })) ?? null
    ),

  /** The draft's link: the one that is on, or a new one. */
  create: verified
    .input(draftId)
    .errors({
      NO_DOCUMENT: { status: 409, message: "Pick an agreement first." },
    })
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors }) => {
      if (context.draft.documentId === null) throw errors.NO_DOCUMENT()
      const link = await shareDraft(context.db, {
        id: input.id,
        userId: context.user.id,
      })
      // Deleted between the owner check and the lock.
      if (!link) throw errors.NOT_FOUND()
      logInfo("share_created", { draftId: input.id, userId: context.user.id })
      return link
    }),

  /** Turns the draft's link off; it never works again. */
  revoke: authed
    .input(draftId)
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input }) => {
      const revoked = await revokeShares(
        context.db,
        { id: input.id, userId: context.user.id },
        new Date()
      )
      logInfo("share_revoked", {
        draftId: input.id,
        userId: context.user.id,
        revoked,
      })
    }),

  /**
   * What the share page shows anyone with the link. A link that is off,
   * unknown or deleted is the same "not found", so links can't be probed.
   */
  view: pub
    .input(z.object({ token }))
    .errors({
      NOT_FOUND: {
        message: "This link doesn't work. It may have been turned off.",
      },
    })
    .handler(async ({ context, input, errors }) => {
      const shared = await sharedDraft(context.db, input.token)
      // Counts of opened and failed links, never the token: many misses in a
      // row would be someone guessing.
      logInfo("share_viewed", { outcome: shared ? "found" : "not_found" })
      if (!shared?.documentId) throw errors.NOT_FOUND()
      return {
        title: shared.title,
        documentId: shared.documentId,
        // In the document's own shape, as every other read of a draft.
        values: definitionOf(shared.documentId).draftSchema.parse(
          shared.fields
        ),
      }
    }),
}
