---
id: PAR-47
title: Mark a reply cut short by a reload or Stop as stopped
phase: backlog
priority: low
origin: PAR-33
created: 2026-09-30T17:40:48Z
updated: 2026-09-30T17:40:48Z
---

Found by the QA-fixes wave (PAR-33 lane). Since PAR-33, a reply cut by a reload or Stop is saved so far. It later shows as a normal finished bubble, possibly cut mid-sentence.

Suggestion: in onEnd, set metadata { interrupted: true } when the model was stopped, and show a small "Stopped" note (with Continue or Try again) under the bubble. Needs a wording and design choice.

Done when: a stopped reply is visibly marked after a reload; worker test + browser test.
