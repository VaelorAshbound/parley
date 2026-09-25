import type { DocumentId } from "@workspace/documents"
import { and, desc, eq, getTableColumns } from "drizzle-orm"

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

/** The query behind listDrafts, for EXPLAIN in the tests. */
export function listDraftsQuery(
  db: Db,
  { userId, limit = 50 }: { userId: string; limit?: number }
) {
  return db
    .select({
      id: draft.id,
      documentId: draft.documentId,
      title: draft.title,
      status: draft.status,
      updatedAt: draft.updatedAt,
    })
    .from(draft)
    .where(eq(draft.userId, userId))
    .orderBy(desc(draft.updatedAt))
    .limit(limit)
}

/** The sidebar: the user's drafts, last changed first. */
export async function listDrafts(
  db: Db,
  options: { userId: string; limit?: number }
) {
  return listDraftsQuery(db, options)
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
