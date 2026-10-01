---
id: PAR-25
title: "UI coverage to the spec's 85% lines / 80% branches: component tests for account, sign-in and billing screens"
phase: cancelled
priority: medium
origin: PAR-1
created: 2026-09-29T19:14:47Z
updated: 2026-09-29T20:40:15Z
---

Found in T34 (coverage gates). spec §6 asks the UI (`apps/web/src/features`, `components`) for 85% lines and 80% branches. The unit + Chromium component tests reach 63% / 62% (features) and 86% / 76% (components) on 2026-09-29. `pnpm test:coverage:ui` (E2E workflow, component job) enforces that floor today, so it can't drop.

Not covered by component tests (e2e only): the account settings cards (two-factor, password, email, sessions, profile, delete account, appearance), sign-in / sign-up forms and social buttons, pricing and `use-billing`, `choose-document`, `draft-menu`, `use-draft-actions`.

Done when: component tests (Vitest browser mode) for those screens bring features to 85/80 and components to 85/80, and the thresholds in `vite.config.ts` (UI_COVERAGE branch) are raised to the spec's numbers.

Option to weigh: collect V8 coverage from the Playwright e2e run on the dev server (Chromium) and merge it, instead of writing every component test.
