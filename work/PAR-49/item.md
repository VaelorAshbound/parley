---
id: PAR-49
title: >-
  Test gaps from the /ship review (guest GitHub link, Polar other events, Pro
  limit, model failure mid-turn, 2FA rate limit, Pro in auth matrix)
phase: backlog
priority: medium
origin: PAR-1
created: 2026-10-01T20:06:58Z
updated: 2026-10-01T20:06:58Z
---

From T40's test-engineer review (work/PAR-1/ship.md). Important:
1. Guest + GitHub sign-in to an existing confirmed account moves the draft; a refused GitHub sign-in keeps the guest's session and draft (apps/web-worker-tests/test/oauth.test.ts).
2. A signed Polar webhook with another event type, or an unparsable body, answers 200 and changes nothing (billing.test.ts).
3. A Pro user gets 500 messages a day on a live session (webhook after the cookie exists), and export.docx works (limits.test.ts).
4. OpenRouter fails mid-turn (before and after the first token): what is saved, is the day's message used, what the browser gets (chat.test.ts).
5. The 2FA code step is rate limited (two-factor.test.ts).
6. Pro callers (owner, other) in auth-matrix.test.ts.
Nice to have: production smoke checks scriptedAi false; double guest link doesn't double AI usage (packages/db/test/guests.test.ts); CSP e2e on share and settings pages; two chat.send at once on one draft.
