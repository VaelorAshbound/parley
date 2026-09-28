---
id: PAR-20
title: Two-factor hardening and small fixes from the Checkpoint 6 review
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-28T17:21:40Z
---

- Turning 2FA on doesn't sign out other devices: offer "Sign out other devices" on the codes step (revokeOtherSessions).
- Trusted devices outlive a password reset/change: forgetTrustedDevices in onPasswordReset, and on password change with "sign out other devices".
- A TOTP code can be reused within its window (Better Auth has no option): record as an accepted risk in an ADR note.
- backup-codes.tsx: catch a refused clipboard write ("Couldn't copy. Use Download."); revokeObjectURL after ~1 s (Safari).
- TOTP_NOT_ENABLED has no message (guest session on /two-factor): show a clear one.
- Rate-limit message says "a minute" while the limit is 3 per 10 s.
- guest_carried cookie: expire on any new session.
