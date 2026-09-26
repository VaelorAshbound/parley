---
id: PAR-16
title: Keep share tokens out of Workers Logs (request path /s/:token)
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T22:35:56Z
updated: 2026-09-25T22:35:56Z
---

From T25. Workers Logs' invocation records keep the request path, and /s/:token puts the bearer token in it. redact_query_string only covers query strings. Only account operators can read these logs, but production (T38) should filter or redact the path.
