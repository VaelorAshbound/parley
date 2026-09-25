# ADR-0006: The export quota counts rows in its own table, under a per-user lock

## Status

Accepted (built in T24, 2026-09-25)

## Context

Spec §2 Quota: a document "counts" on its first export (`draft.firstExportedAt`). Free users get 3 counted documents per calendar month (UTC); Pro has no limit; exporting a counted document again is free. DOCX needs Pro. Only a confirmed email may export (T21's `verified` base).

This is a money path. Four ways to get it wrong:

1. **Counting drafts.** If the limit were "drafts with `firstExportedAt` this month", deleting a downloaded draft would give its place back: download, delete, repeat, forever.
2. **Two downloads at once.** Two requests can both read "2 used" and both take the third free document.
3. **Charging for nothing.** If we count before the file exists, a Browser Run failure, or a user who closed the tab, still costs a free document.
4. **Switching the agreement.** A draft counted as an NDA could be switched to another agreement and downloaded "again" for free.

## Decision

- **A `counted_export` table**, one row per counted document: `user_id` (cascades with the user), `draft_id` (no foreign key, on purpose), `counted_at`, and an index on `(user_id, counted_at)`. The monthly count is `count(*)` of the user's rows since the start of the UTC month. Deleting a draft keeps its row, so its place is not given back. `draft.firstExportedAt` stays the "already counted" flag for re-exports.
- **The rules are one pure function** (`server/quota.ts` `decideExport`), unit tested on every edge. The database side (`@workspace/db` `queries/exports.ts`) only counts and records.
- **Order of work in `exportDraft`:** refuse early (plan, quota, unfinished draft) before spending Browser Run time; build the file; stop if the request was aborted; then, in one transaction, take `pg_advisory_xact_lock(hashtextextended('export:<user>', 0))`, read the draft again, decide again, and record the count. The lock is transaction-scoped, so it is released on commit or rollback and works behind Hyperdrive's transaction pooling. Counting last means a failed print or a user who left is never charged.
- **Choosing another agreement resets `firstExportedAt`** (`drafts.chooseDocument`): it is a new document, counted on its next download. The old count stays.

## Alternatives Considered

### Count drafts by `firstExportedAt`

- Pros: No new table.
- Cons: Deleting a downloaded draft frees its place (problem 1).
- Rejected: the limit must survive deletes.

### A monthly counter row per user (`user_id, month, used`)

- Pros: One row per user and month; an `UPDATE … WHERE used < 3` is atomic without a lock.
- Cons: Loses which draft was counted, so "was this draft counted this month?" and support questions can't be answered; still needs the draft's flag in the same transaction.
- Rejected: the row-per-document table is as cheap at this scale and keeps the history.

### `SELECT … FOR UPDATE` on the user row

- Pros: No advisory lock.
- Cons: Locks Better Auth's `user` row, which sign-in and session refresh also write; a slow export would hold up auth.
- Rejected: the advisory lock touches nothing else.

### Count first, refund on failure

- Pros: The lock is held only for a moment before the print.
- Cons: A refund path that must never fail, and a crash between the two leaves a wrong count.
- Rejected: counting after the print is simpler and never charges wrongly. The cost is that a request which loses the race after printing wasted one Browser Run print (a fraction of a cent).

## Consequences

- Re-exporting a counted document is free by design, so a user can edit a counted draft (new parties, new terms) and download it again without counting. The spec accepts this; switching the agreement is the one case that counts again.
- Re-exports still cost Browser Run time. T27 should add `export.*` to the per-user RPC rate limit.
- `planOf` returns "free" for everyone until T26 reads the Polar subscription; Word files are refused (`PRO_REQUIRED`) until then.
- Migration `0002_counted_export` is additive (a new table and index). The lead applies it to Neon after merge.
