---
id: PAR-8
title: "Fix two e2e tests that fail locally: Firefox 'no layout shift' (NS_BINDING_ABORTED on goto) and Chromium 'first visit' (main empty past 5 s)"
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T13:00:28Z
updated: 2026-09-25T13:00:28Z
---

Found while merging T21 (wave A). Both fail on the code before T21 too, so T21 did not cause them.
CI runs e2e in Chromium only, so the Firefox one never showed. T32 plans e2e in 3 browsers, so fix before T32.
- shell.spec.ts:120 in Firefox: `page.goto` aborted (NS_BINDING_ABORTED), 3 of 3 runs.
- shell.spec.ts:25 in Chromium: main still empty at the 5 s expect timeout on a busy local dev server; the page fills in a moment later.
