---
id: PAR-61
title: Test harness leaks Postgres and workerd processes when a test run is killed
phase: backlog
priority: medium
origin: PAR-8
created: 2026-10-03T09:51:15Z
updated: 2026-10-03T09:51:15Z
---

Wave 2 (2026-10-03): when a worker/db test run is killed (timeout or OOM), packages/db/testing/postgres.ts servers and miniflare workerd processes keep running with PPID 1 (3 Postgres + 4 workerd, ~2 GB, in one lane). With no swap this helped push the laptop into the OOM killer and crashed the desktop shell. Fix: the harness stops its servers when its parent dies (watch the parent pid / stdin close, or a process group killed on exit); add a test that kills the runner and checks nothing is left.
