---
id: PAR-26
title: Drop the Stryker patch once its Vitest runner supports Vitest 5
phase: cancelled
priority: low
origin: PAR-1
created: 2026-09-29T19:14:49Z
updated: 2026-09-29T20:40:15Z
---

Found in T34. `@stryker-mutator/vitest-runner` 10.0.0 names tests with their suite names joined by " ", but Vitest 5 matches `-t` against the names joined with " > " (`fullTestName`). Without the fix every mutant runs 0 tests and survives (a 0% score that looks like weak tests).

Fixed for now with a pnpm patch: `patches/@stryker-mutator__vitest-runner@10.0.0.patch` (listed in `pnpm-workspace.yaml` `patchedDependencies`).

Done when: a Stryker release supports Vitest 5; drop the patch, upgrade, and check `pnpm test:mutation` still kills mutants (quota.ts is 100% killed with the patch).
