---
id: PAR-37
title: Composer cuts pasted text at 4000 characters with no feedback
phase: build
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T16:11:02Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Composer silently cuts pasted text at 4000 characters
(QA area: journeys)

- Steps: Paste or fill 5000 characters into the chat composer and send.
- Expected: A counter or message near the limit, so the user knows the end of their text was dropped.
- Actual: The textarea maxLength=4000 drops the rest with no feedback, and the message is sent cut off mid-word ('…roadmap w').
- Evidence: qa/journeys/30-long-msg.png, 31-long-sent.png. value.length = 4000 after filling 5000.
- Likely file: apps/web/src/features/chat/composer.tsx:81

Done when: going over the limit is shown (counter or message) and nothing is cut silently.
