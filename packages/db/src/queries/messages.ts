import { and, asc, eq, exists, inArray, ne, sql } from "drizzle-orm"

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
  const messages = await listSavedMessages(db, key)
  return messages.map(({ id, role, parts }) => ({ id, role, parts }))
}

/**
 * The chat with when each message was first saved: how old the last turn
 * is tells a page whether Parley can still be answering it (PAR-33).
 */
export async function listSavedMessages(
  db: Db,
  key: DraftKey
): Promise<(StoredMessage & { savedAt: Date })[]> {
  return db
    .select({
      id: message.id,
      role: message.role,
      parts: message.parts,
      savedAt: message.createdAt,
    })
    .from(message)
    .innerJoin(draft, eq(draft.id, message.draftId))
    .where(and(eq(draft.id, key.id), eq(draft.userId, key.userId)))
    .orderBy(asc(message.createdAt), asc(message.id))
}

/**
 * A message id that is already another draft's, the other speaker's, or a
 * user's message already saved (PAR-52). The rest of that save may have gone
 * through, so call saveMessages in a transaction when it must be all or
 * nothing: thrown there, it undoes the whole transaction, a counted message
 * too.
 */
export class MessageIdTaken extends Error {
  override name = "MessageIdTaken"
  constructor() {
    super("That message id is already taken.")
  }
}

/**
 * Saves messages to a draft the user owns: new ones are added, and an
 * assistant's message saved before (same id, same draft) is replaced, like a
 * reply that grew. A user's message is never replaced. It also marks the
 * draft as just changed. False when the draft isn't the user's; throws
 * MessageIdTaken for an id it won't take.
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
  const saved = await db
    .insert(message)
    .values(
      messages.map((each, index) => ({
        id: each.id,
        draftId: key.id,
        role: each.role,
        parts: each.parts.map(withoutNul),
        // The chat's order. clock_timestamp(), not the default now(): now()
        // is fixed for a whole transaction, so a batch (or two saves in one
        // transaction) would tie; the offset keeps a batch in its order.
        createdAt: sql`clock_timestamp() + ${index} * interval '1 microsecond'`,
      }))
    )
    .onConflictDoUpdate({
      target: message.id,
      set: { parts: sql`excluded.parts` },
      // An id from another draft is never taken over, and a message never
      // changes speaker: a user's message can't rewrite the assistant's.
      // Only a reply grows: what the user said stays as said, whatever the
      // chat looks like to the caller (one the tools no longer fit reads as
      // empty, so no id check before this one can see it).
      setWhere: and(
        eq(message.draftId, key.id),
        eq(message.role, sql`excluded.role`),
        ne(message.role, "user")
      ),
    })
    .returning({ id: message.id })
  // A row the guard above kept from changing is left out; without this the
  // message would be lost with no word (PAR-52).
  if (saved.length !== messages.length) throw new MessageIdTaken()
  return true
}

/**
 * Deletes these messages from a draft the user owns; ids that aren't this
 * draft's are left alone. A retried turn takes back what the failed one
 * left after the user's message (PAR-7).
 */
export async function deleteMessages(
  db: Db,
  key: DraftKey,
  ids: readonly string[]
) {
  if (ids.length === 0) return
  await db.delete(message).where(
    and(
      inArray(message.id, [...ids]),
      eq(message.draftId, key.id),
      exists(
        db
          .select({ id: draft.id })
          .from(draft)
          .where(and(eq(draft.id, key.id), eq(draft.userId, key.userId)))
      )
    )
  )
}

/**
 * A copy of a JSON value with every NUL character (U+0000) taken out of its
 * strings and keys. jsonb refuses NUL (Postgres 22P05), so one stray NUL in a
 * model's reply would fail the whole save and lose the reply.
 */
function withoutNul(value: unknown): unknown {
  if (typeof value === "string") return value.replaceAll("\u0000", "")
  if (Array.isArray(value)) return value.map(withoutNul)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [
        key.replaceAll("\u0000", ""),
        withoutNul(each),
      ])
    )
  }
  return value
}
