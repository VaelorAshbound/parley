---
id: PAR-51
title: "Export: count and file can name different agreements if the agreement changes during the print"
phase: done
priority: low
origin: PAR-1
created: 2026-10-01T20:06:58Z
updated: 2026-10-03T07:50:20Z
---

From T40's code review: apps/web/src/server/rpc/export.ts:372-390 builds the file from context.draft (read before the ~4 s print) but records the count against `fresh` inside the lock. If chooseDocument runs during the print, the user gets agreement A while B is counted. Totals stay right, attribution is wrong. Fix: in the transaction, if fresh.documentId !== draft.documentId, return a retryable conflict.
