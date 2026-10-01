---
id: PAR-50
title: "pnpm dev: detect wrangler login like wrangler does; harden scripts/dev.ts"
phase: backlog
priority: low
origin: PAR-1
created: 2026-10-01T20:06:58Z
updated: 2026-10-01T20:06:58Z
---

From T40's code review:
- apps/web/vite.config.ts signedInToCloudflare() misses ~/.wrangler and macOS (~/Library/Preferences/.wrangler): use `wrangler whoami --json` (short timeout) or check those paths.
- scripts/dev.ts: a db:dev exit after "ready" leaves the app running with no database (stop on exit); "is ready" is matched per chunk (buffer by line); Ctrl+C during startup ends with an unhandled rejection.
- Tests: the .dev.vars setup (new secret written, existing file untouched, fails loudly if BETTER_AUTH_SECRET= is missing); optional CI step: fresh clone with no keys, one chat turn.
