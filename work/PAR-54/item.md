---
id: PAR-54
title: >-
  Desktop WebKit crashes on draft pages ("Page crashed"); check real Safari on a
  Mac
phase: cancelled
priority: medium
origin: PAR-1
created: 2026-10-01T21:05:56Z
updated: 2026-10-01T21:08:26Z
---

Final checkpoint, 2026-10-01: e2e run 36924266491 (desktop webkit: 1 failed, 3 flaky) and a local re-run in mcr.microsoft.com/playwright:v1.63.0-noble (1 failed, 3 flaky, different tests). Every failure is "Page crashed" on a draft page with the document panel open (shell.spec panel close/reopen/drag, export.spec guest PDF, a11y dark @phone draft). webkit-phone passes in full; Chromium and Firefox pass.
First: open the live site in real Safari (macOS) and do the shell flows (close/reopen the panel, drag it, download as guest). If Safari is fine, it's Playwright's Linux WebKit: note it and keep webkit out of the required set. If not, bisect (Resizable panel, motion layout, fonts).
