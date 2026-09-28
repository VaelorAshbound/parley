---
id: PAR-19
title: "Two-factor audit lines: challenge, failed, locked, backup codes, claim"
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-28T17:21:40Z
---

Checkpoint 6 review (2FA, Required #3). A correct password with 2FA on logs session_created then session_ended (looks like a real sign-in); wrong codes, backup-code use, the 15-minute lock and regenerated backup codes aren't logged; claimUnconfirmedAccount turns 2FA off with a direct write, so no two_factor_off line. Add IDs-only lines: two_factor_challenge, two_factor_failed, two_factor_locked, backup_codes_regenerated, two_factor_off with reason "claim". Load observability-and-instrumentation first.
