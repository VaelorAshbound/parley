---
id: PAR-63
title: >-
  Stopped reply is lost when a new message is sent right after Stop
  (chat_turn_superseded)
phase: backlog
priority: medium
origin: PAR-47
created: 2026-10-03T12:52:30Z
updated: 2026-10-03T12:52:30Z
---

Seen by the PAR-47 lane: after Stop, a message sent at once starts a new turn before the stopped turn's save runs, so the stopped reply is not stored (logged chat_turn_superseded). Expected: the stopped reply is saved with its Stopped mark, then the new turn runs.
