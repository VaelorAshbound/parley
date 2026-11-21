---
id: PAR-64
title: "Workers Builds fails: the dev-run tests count a zombie as still running"
phase: review
priority: high
created: 2026-11-21T09:43:03Z
updated: 2026-11-21T10:11:20Z
---

Two Workers Builds of main (e71d5a9) failed in `pnpm test:coverage`: 4 tests in
`scripts/dev-run.test.ts` time out waiting for a stopped stand-in process to be
gone. The code is the same as the last green build (2026-11-16), so the build
environment changed.

A process whose parent has exited goes to the first process on the machine. If
that one never collects it, the process stays a zombie after it is stopped, and
the tests' `running()` helper (`kill(pid, 0)`) still counts it as running.
`runDev` itself is fine: it waits only for its own children.

Done when: the tests count a zombie as gone, a test shows it with a real
zombie, and a Workers Build of main is green.
