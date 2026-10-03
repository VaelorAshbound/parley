### 2026-10-01T21:05:56Z
Created.

### 2026-10-03T12:52:29Z
Wave 2 merged to main d79c6b1 and deployed 2026-10-03 (smoke green). Gate on merged code: check, 1415 unit, 521 worker, 154 e2e (Chromium + Firefox) passed.

### 2026-10-03T12:52:29Z
phase: backlog -> done

### 2026-10-03T12:52:29Z
The item's guess (lazy definition chunk) was wrong. Real cause: chooseDocument waited for drafts/get before the panel switched. Fixed in adbe0c0, 95dd3a1, 4446b6e, 9f1cbcc (also a crash when switching agreements). After: 14-20 ms over 10 runs, also with drafts/get +300 ms (work/PAR-55/latency.md).
