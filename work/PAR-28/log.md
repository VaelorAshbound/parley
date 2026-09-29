### 2026-09-29T21:28:33Z
Created.

### 2026-09-29T21:46:59Z
Done: idempotency key now includes GITHUB_RUN_ATTEMPT (reportIdempotencyKey, unit tested). Merged eabf8e6. Proof on a real re-run comes with the next nightly re-run.

### 2026-09-29T21:46:59Z
phase: backlog -> done

### 2026-09-29T21:58:10Z
Proven against real Resend (to delivered@resend.dev, same RUN_URL): attempt 1 sent; attempt 2 with a changed body (a re-run) sent; attempt 1 again with a changed body got the 409 invalid_idempotent_request from the bug. So re-runs send, and duplicates of one attempt are still blocked.
