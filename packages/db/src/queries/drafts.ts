import type { DocumentId } from "@workspace/documents"
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm"

import type { Db } from "../client.ts"
import { draft, type JsonObject } from "../schema.ts"
import { single } from "./rows.ts"

// Every query that takes a draft id also takes the user id and matches both,
// so no query can reach another user's draft (spec §7: ownership on every
// read and write).

/** A draft row without the internal search column. */
const { search: _search, ...columns } = getTableColumns(draft)

export type Draft = Omit<typeof draft.$inferSelect, "search">
export type DraftKey = { id: string; userId: string }

export async function createDraft(
  db: Db,
  values: {
    userId: string
    documentId: DocumentId | null
    title: string
    fields?: JsonObject
    status?: Draft["status"]
  }
): Promise<Draft> {
  return single(await db.insert(draft).values(values).returning(columns))
}

/**
 * `lock` takes a row lock (SELECT … FOR UPDATE) until the transaction ends,
 * so two edits to one draft (the AI and the user) run one after the other.
 */
export async function getDraft(
  db: Db,
  key: DraftKey,
  { lock = false }: { lock?: boolean } = {}
) {
  const query = db.select(columns).from(draft).where(owned(key))
  const [row] = await (lock ? query.for("update") : query)
  return row
}

export type ListOptions = {
  userId: string
  /** Words to search for, each matched from its start ("acm bol"). */
  query?: string | undefined
  documentId?: DocumentId | undefined
  /** The last draft of the page before: the list goes on after it. */
  after?: Pick<Draft, "id" | "updatedAt"> | undefined
  limit?: number | undefined
}

/** The query behind listDrafts, for EXPLAIN in the tests. */
export function listDraftsQuery(
  db: Db,
  { userId, query, documentId, after, limit = 50 }: ListOptions
) {
  const terms = query === undefined ? null : prefixQuery(query)
  return db
    .select({
      id: draft.id,
      documentId: draft.documentId,
      title: draft.title,
      status: draft.status,
      updatedAt: draft.updatedAt,
    })
    .from(draft)
    .where(
      and(
        eq(draft.userId, userId),
        terms === null
          ? undefined
          : sql`${draft.search} @@ to_tsquery('simple', ${terms})`,
        documentId === undefined ? undefined : eq(draft.documentId, documentId),
        // A row comparison, so Postgres starts the page inside the index.
        after === undefined
          ? undefined
          : sql`(${draft.updatedAt}, ${draft.id}) < (${after.updatedAt.toISOString()}::timestamptz, ${after.id}::uuid)`
      )
    )
    .orderBy(desc(draft.updatedAt), desc(draft.id))
    .limit(limit)
}

/**
 * The history (sidebar, /drafts): the user's drafts, last changed first, one
 * page at a time, optionally searched and filtered by document type.
 */
export async function listDrafts(db: Db, options: ListOptions) {
  return listDraftsQuery(db, options)
}

/**
 * A search box's text as a tsquery that matches every word from its start
 * ("acm bol" → `acm:* & bol:*`), or null when it has no words. Only letters
 * and digits get through, so nothing typed is read as tsquery syntax.
 */
function prefixQuery(text: string) {
  const words = text.match(/[\p{L}\p{M}\p{N}]+/gu)
  if (!words) return null
  return words
    .slice(0, 10)
    .map((word) => `${word}:*`)
    .join(" & ")
}

export async function updateDraft(
  db: Db,
  key: DraftKey,
  changes: Partial<Pick<Draft, "documentId" | "title" | "fields" | "status">>
) {
  const [row] = await db
    .update(draft)
    .set(changes)
    .where(owned(key))
    .returning(columns)
  return row
}

/**
 * A new draft with the same agreement, answers and status. The chat, share
 * links and export count stay with the original.
 */
export async function duplicateDraft(
  db: Db,
  key: DraftKey,
  { title }: { title: string }
) {
  const original = await getDraft(db, key)
  if (!original) return undefined
  return createDraft(db, {
    userId: original.userId,
    documentId: original.documentId,
    title,
    fields: original.fields,
    status: original.status,
  })
}

/** Deletes the draft with its messages and share links (cascade). */
export async function deleteDraft(db: Db, key: DraftKey) {
  const rows = await db
    .delete(draft)
    .where(owned(key))
    .returning({ id: draft.id })
  return rows.length > 0
}

function owned({ id, userId }: DraftKey) {
  return and(eq(draft.id, id), eq(draft.userId, userId))
}
