---
id: PAR-38
title: Search with no letters or digits (e.g. an emoji) lists every draft
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Search with no letters or digits (e.g. '🚀') lists every draft as a result
(QA area: journeys)

- Steps: Ctrl+K and type 🚀 (or any query with only symbols that are not letters, digits or marks).
- Expected: 'No drafts match "🚀"' (or match titles that contain it).
- Actual: The dialog switches to 'Drafts' results and lists all 3 drafts. prefixQuery returns null for a query with no words, and listDrafts treats null as 'no filter'. By contrast '<b>' gives 'No drafts match'.
- Evidence: Search dialog text for '🚀': 'Drafts | Agency <b>website</b> & Co 🚀 | New draft | Mutual Non-Disclosure Agreement | See all results'. packages/db/src/queries/drafts.ts:60-75, 101-102.
- Likely file: packages/db/src/queries/drafts.ts

Done when: a query with no words gives 'No drafts match' (or the recent list), with a test in packages/db.
