### 2026-09-29T21:52:07Z
Created.

### 2026-10-03T07:17:52Z
Wave 1 (fix/wave-1): /s/ (also /S/, /%73/) SSR writes no console lines; outcome and errors go to trace span attributes. Open: check in Workers Observability on a Preview.

### 2026-10-03T07:50:20Z
Verified on production 2026-10-03: ~400 /s/ requests produced trace spans only, no cf-worker log lines, and no event holds the test tokens (needle search).

### 2026-10-03T07:50:20Z
phase: backlog -> done
