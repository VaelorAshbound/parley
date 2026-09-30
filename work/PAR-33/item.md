---
id: PAR-33
title: >-
  Reload during a reply leaves the question unanswered; the reply shows only
  after another reload
phase: done
priority: medium
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T18:08:51Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Reload during a reply leaves the question unanswered with no status; the finished reply only shows after another manual reload
(QA area: journeys)

- Steps: 1. On a draft (scripted AI cookie on), send 'second reload roadmap'. 2. Reload the page 0.3 s later. 3. Wait 15 s. 4. Reload again.
- Expected: After the reload the chat shows the reply in progress, or picks it up when the server finishes, or at least offers Try again.
- Actual: After step 2 the chat ends with the user's message: no 'Thinking…', no reply, no Try again, Send disabled until you type. 15 s later still nothing. Step 4 shows the full reply (Mutual NDA selected + Purpose change), so the server finished long before. The code says 'A turn that was cut off isn't resumed; its saved part shows on reload', but the page loaded during the turn never refetches.
- Evidence: qa/journeys/33-reload-mid.png, 34-reload-mid-15s.png. innerText at 15 s ended with '…second reload roadmap'. After the next reload the reply was present.
- Likely file: apps/web/src/features/chat/transport.ts (and the chat messages query in features/chat/chat-panel.tsx)

Done when: after a reload mid-reply the chat shows the saved reply (or a working 'still answering' state) without a second manual reload; e2e covers it.
