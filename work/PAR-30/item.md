---
id: PAR-30
title: "e2e keyboard golden path fails locally: the chat reply after the last answer is never sent"
phase: done
priority: medium
origin: PAR-22
created: 2026-09-29T21:46:59Z
updated: 2026-09-30T18:08:51Z
---

Found by PAR-22: e2e/keyboard.spec.ts "the golden path with only a keyboard" (both reduced-motion variants) fails locally on the base code (f5b7b14) too: it times out waiting for "Undo Purpose" because the chat reply after the last answer is never sent. Chromium, local dev server. Check whether it is the local AI setup or a real bug; compare with CI.
