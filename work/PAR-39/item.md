---
id: PAR-39
title: Send guard reads render state, so two sends in the same task both go through
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Two sends in the same task both go through: the send guard reads render state, not a ref
(QA area: journeys)

- Steps: In the composer type 'double send check', then in one JS task dispatch keydown Enter twice and click Send (eval).
- Expected: One message.
- Actual: 3 identical user messages and 3 replies, all saved (still 3 after reload). Real input did not reproduce it: rapid real Enter presses and a real dblclick on Send both gave 1. So the risk is low, but the guard is not atomic.
- Evidence: qa/journeys/33-reload-mid.png shows 3× 'double send check' and 3× scripted replies. Count after reload = 3. Real batch press = 1, dblclick = 1.
- Likely file: apps/web/src/features/chat/composer.tsx

Done when: the send guard is a ref (atomic); a test dispatching two sends in one task saves one message.
