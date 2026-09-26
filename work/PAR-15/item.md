---
id: PAR-15
title: "Share links: partial unique index share(draft_id) WHERE revoked_at IS NULL"
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-25T22:35:56Z
updated: 2026-09-25T22:35:56Z
---

From the T25 review. A row lock keeps one live link per draft, and a two-connection test proves it. A partial unique index would make the database enforce it too. Needs a migration.
