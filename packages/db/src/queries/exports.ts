import type { DocumentId } from "@workspace/documents"
import { and, count, eq, gte, isNotNull, isNull, sql } from "drizzle-orm"

import type { Db } from "../client.ts"
import { countedExport, draft } from "../schema.ts"
import type { DraftKey } from "./drafts.ts"

// The export quota's database side (spec §2 Quota, ADR-0006). The rules are
// in the app (server/quota.ts); these read and write the counts.

/**
 * Makes the user's other exports wait until this transaction ends, so two
 * exports at once can't both take the last free document of the month. A
 * transaction-level advisory lock: released on commit or rollback, and safe
 * behind Hyperdrive's transaction pooling.
 */
export async function lockExports(tx: Db, userId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`export:${userId}`}, 0))`
  )
}

/** Documents the user has had counted since `since`. */
export async function countExportsSince(
  db: Db,
  { userId, since }: { userId: string; since: Date }
) {
  const [row] = await db
    .select({ used: count() })
    .from(countedExport)
    .where(
      and(eq(countedExport.userId, userId), gte(countedExport.countedAt, since))
    )
  return row?.used ?? 0
}

/**
 * When the draft's agreement was counted, or null. A draft switched back to
 * an agreement it was downloaded as keeps that count (spec §2 Quota).
 */
export async function countedAt(
  db: Db,
  { draftId, documentId }: { draftId: string; documentId: DocumentId }
) {
  const [row] = await db
    .select({ countedAt: countedExport.countedAt })
    .from(countedExport)
    .where(
      and(
        eq(countedExport.draftId, draftId),
        eq(countedExport.documentId, documentId)
      )
    )
  return row?.countedAt ?? null
}

/**
 * Counts the draft's first export as its current agreement: sets
 * `firstExportedAt` and adds a counted row. Does nothing (false) when the
 * draft was counted already, has no agreement or isn't the user's. Run it in
 * a transaction with `lockExports`.
 */
export async function recordExport(db: Db, key: DraftKey, at: Date) {
  const marked = await db
    .update(draft)
    // A download isn't an edit: the draft keeps its place in the sidebar.
    .set({ firstExportedAt: at, updatedAt: sql`${draft.updatedAt}` })
    .where(
      and(
        eq(draft.id, key.id),
        eq(draft.userId, key.userId),
        isNull(draft.firstExportedAt),
        isNotNull(draft.documentId)
      )
    )
    .returning({ documentId: draft.documentId })
  const documentId = marked[0]?.documentId
  if (!documentId) return false
  await db
    .insert(countedExport)
    .values({ userId: key.userId, draftId: key.id, documentId, countedAt: at })
  return true
}
