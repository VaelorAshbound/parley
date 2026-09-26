---
id: PAR-14
title: >-
  Purge expired verification and old rate_limit rows; index
  rate_limit.last_request and session.expires_at
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T22:35:56Z
updated: 2026-09-25T22:35:56Z
---

From T27 and T28. The nightly purge (T28) removes idle guests and expired sessions, but expired `verification` rows and old `rate_limit` rows are never removed. T27's 1-hour guest rule makes Better Auth keep rate_limit rows for an hour, and its prune has no index. The purge's session scan also has no index on expires_at (Better Auth's generated schema, so it needs a decision there).
