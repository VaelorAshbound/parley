---
id: PAR-44
title: "Document panel: no 'expand to full width' and no card in the chat to reopen it (spec §1)"
phase: build
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T18:09:53Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Document panel has no 'expand to full width' and no card in the chat to reopen it (spec §1)
(QA area: journeys)

- Steps: Open a draft. Look at the panel header, then close the panel and scroll the chat.
- Expected: Spec §1: the header has document type, Share, Download, expand to full width and close. 'When it is closed, a card in the chat opens it again.'
- Actual: Header has type, Share, Download and close only. When closed, the only way back is the small icon in the chat header ('Open document'). No card in the chat. grep finds no expand or reopen-card code, and todo.md only says 'expand to full width T16' with no decision to drop it.
- Evidence: qa/journeys/07-nda-reply.png (header), 26-closed-x.png and 27-closed-top.png (closed, no card). chat-column.tsx:64 is the only reopen control.
- Likely file: apps/web/src/routes/-components/shell/document-panel.tsx, chat-column.tsx

### No card in the chat to reopen a closed document; only a small header icon
(QA area: sizes-feel)

- Steps: Open /d/<id>?panel=closed at 1440 (or any draft at 768 with the sidebar open).
- Expected: Spec §1 Layout: 'When it is closed, a card in the chat opens it again.'
- Actual: The chat shows only the messages. The only way back is the 16px panel icon at the top right of the chat header ('Open document').
- Evidence: qa/sizes-feel/draft-1440-closed.png, qa/sizes-feel/draft-768.png
- Likely file: apps/web/src/routes/-components/shell/chat-column.tsx

Done when: the spec §1 controls exist, or the spec is changed to match the build (owner decision).
