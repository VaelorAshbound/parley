---
id: PAR-58
title: "pnpm dev: SIGKILL the db/app process groups on a second Ctrl+C or after a grace timeout"
phase: backlog
priority: low
origin: PAR-50
created: 2026-10-03T07:17:52Z
updated: 2026-10-03T07:17:52Z
---

From wave 1 (PAR-50 review). A child that ignores SIGTERM makes pnpm dev hang; a second Ctrl+C then leaves the detached groups running (scripts/dev-run.ts).
