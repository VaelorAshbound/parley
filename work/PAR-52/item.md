---
id: PAR-52
title: "Chat: a message id that exists in another draft is dropped silently"
phase: done
priority: low
origin: PAR-1
created: 2026-10-01T20:06:58Z
updated: 2026-10-03T07:50:20Z
---

From T40's code review: packages/db/src/queries/messages.ts:78-87 with chat.ts: MESSAGE_ID_TAKEN only checks this draft; an id from another draft makes the upsert a no-op, the quota is spent and the user's message is missing from history. Only crafted ids trigger it. Fix: check rowCount and throw MESSAGE_ID_TAKEN.
