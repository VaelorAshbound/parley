### 2026-09-25T22:35:56Z
Created.

### 2026-10-03T07:17:52Z
Wave 1 (fix/wave-1): purge removes expired verification and rate_limit rows older than 24 h; migration 0005 indexes session.expires_at and rate_limit.last_request (hand-written in generated auth-schema.ts, guarded by a test). Owner OK with both.

### 2026-10-03T07:50:20Z
phase: backlog -> done
