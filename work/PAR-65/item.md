---
id: PAR-65
title: "dev-run tests: afterEach stops cleaning up after one failure, and a half-written pid file could read as pid 0"
phase: backlog
priority: low
origin: PAR-64
created: 2026-11-21T10:11:20Z
updated: 2026-11-21T10:11:20Z
---

From the PAR-64 review, in `scripts/dev-run.test.ts` (older code):

- When `until` throws in `afterEach`, the `rmSync` and the remaining pid files
  are skipped, so one failure spreads to the next test. Put the cleanup in a
  `try/finally`.
- `running()` then `process.kill` can throw ESRCH if the process exits in
  between.
- On every platform, a pid file read while it is still empty gives pid 0:
  `kill(0, 0)` succeeds (it targets the own process group), so `running()`
  says yes, and `process.kill(0, "SIGKILL")` would kill the test runner's own
  process group. The window is very narrow. Guard in `running()`:
  `Number.isInteger(pid) && pid > 0 && alive(pid)`.
