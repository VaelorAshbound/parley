import { and, asc, eq, sql } from "drizzle-orm"

import type { Db } from "../client.ts"
import { draft, message } from "../schema.ts"
import type { DraftKey } from "./drafts.ts"

// A draft's chat, stored as AI SDK UI messages (spec §2 Data model). Like the
// draft queries, each takes the draft id with the user id.

export type StoredMessage = {
  id: string
  role: "system" | "user" | "assistant"
  /** UI message parts; checked with the AI SDK's validateUIMessages on read. */
  parts: readonly unknown[]
}

/** The chat of a draft the user owns, oldest first. */
export async function listMessages(
  db: Db,
  key: DraftKey
): Promise<StoredMessage[]> {
  return db
    .select({ id: message.id, role: message.role, parts: message.parts })
    .from(message)
    .innerJoin(draft, eq(draft.id, message.draftId))
    .where(and(eq(draft.id, key.id), eq(draft.userId, key.userId)))
    .orderBy(asc(message.createdAt), asc(message.id))
}

/**
 * Saves messages to a draft the user owns: new ones are added, ones saved
 * before (same id, same draft) are replaced, like a reply that grew. It also
 * marks the draft as just changed. False when the draft isn't the user's.
 */
export async function saveMessages(
  db: Db,
  key: DraftKey,
  messages: readonly StoredMessage[]
) {
  const touched = await db
    .update(draft)
    .set({ updatedAt: new Date() })
    .where(and(eq(draft.id, key.id), eq(draft.userId, key.userId)))
    .returning({ id: draft.id })
  if (touched.length === 0) return false
  if (messages.length === 0) return true
  await db
    .insert(message)
    .values(
      messages.map((each, index) => ({
        id: each.id,
        draftId: key.id,
        role: each.role,
        parts: [...each.parts],
        // The chat's order. clock_timestamp(), not the default now(): now()
        // is fixed for a whole transaction, so a batch (or two saves in one
        // transaction) would tie; the offset keeps a batch in its order.
        createdAt: sql`clock_timestamp() + ${index} * interval '1 microsecond'`,
      }))
    )
    .onConflictDoUpdate({
      target: message.id,
      set: { parts: sql`excluded.parts` },
      // An id from another draft is never taken over.
      setWhere: eq(message.draftId, key.id),
    })
  return true
}
