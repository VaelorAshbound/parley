---
id: PAR-28
title: Nightly report email fails on a re-run (Resend idempotency key reused)
phase: done
priority: low
origin: PAR-1
created: 2026-09-29T21:28:33Z
updated: 2026-09-29T21:46:59Z
---

scripts/nightly-report.ts sends with an idempotency key that is the same on a re-run of the same workflow run, so Resend answers 409 invalid_idempotent_request (run 36626900139 attempt 2). Add GITHUB_RUN_ATTEMPT to the key.
