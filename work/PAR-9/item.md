---
id: PAR-9
title: >-
  Strip NUL characters from model replies before saving (jsonb refuses them,
  reply is lost)
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-25T13:00:28Z
updated: 2026-09-25T13:00:28Z
---

Found by T29 review. A reply with \u0000 fails saveMessages with 22P05. It is now logged as chat_save_failed, but the reply is lost.
