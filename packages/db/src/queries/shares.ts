import { and, desc, eq, inArray, isNull } from "drizzle-orm"

import type { Db } from "../client.ts"
import { draft, share } from "../schema.ts"
import type { DraftKey } from "./drafts.ts"
import { single } from "./rows.ts"

// Read-only share links (spec §2 Data model, T25). The token is the only key
// to a shared draft: 128 random bits, so it can't be guessed, and every
// lookup by the owner matches the user id too (spec §7). A link that was
// turned off keeps its row, so it never works again.

const link = { token: share.token, createdAt: share.createdAt }

/** 128 random bits (Web Crypto), as 22 base64url letters. */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

/** The user's draft, as a subquery: no match when it isn't theirs. */
function ownedDraft(db: Db, { id, userId }: DraftKey) {
  return db
    .select({ id: draft.id })
    .from(draft)
    .where(and(eq(draft.id, id), eq(draft.userId, userId)))
}

/** The draft's link that is on, or undefined. Only for its owner. */
export async function activeShare(db: Db, key: DraftKey) {
  const [row] = await db
    .select(link)
    .from(share)
    .where(
      and(inArray(share.draftId, ownedDraft(db, key)), isNull(share.revokedAt))
    )
    .orderBy(desc(share.createdAt))
    .limit(1)
  return row
}

/**
 * The draft's link, made on first use: sharing again gives the same link
 * until it is turned off. Undefined when the draft isn't the user's. The row
 * lock on the draft makes two clicks at once give one link.
 */
export async function shareDraft(db: Db, key: DraftKey) {
  return db.transaction(async (tx) => {
    const [owned] = await ownedDraft(tx, key).for("update")
    if (!owned) return undefined
    return (
      (await activeShare(tx, key)) ??
      single(
        await tx
          .insert(share)
          .values({ token: newToken(), draftId: owned.id })
          .returning(link)
      )
    )
  })
}

/** Turns the draft's links off. Gives how many were on. */
export async function revokeShares(db: Db, key: DraftKey, at: Date) {
  const rows = await db
    .update(share)
    .set({ revokedAt: at })
    .where(
      and(inArray(share.draftId, ownedDraft(db, key)), isNull(share.revokedAt))
    )
    .returning({ token: share.token })
  return rows.length
}

/**
 * What a link that is on shows anyone who has it: the draft's title,
 * agreement and values. Never its id, owner, chat or dates.
 */
export async function sharedDraft(db: Db, token: string) {
  const [row] = await db
    .select({
      title: draft.title,
      documentId: draft.documentId,
      fields: draft.fields,
    })
    .from(share)
    .innerJoin(draft, eq(draft.id, share.draftId))
    .where(and(eq(share.token, token), isNull(share.revokedAt)))
  return row
}
