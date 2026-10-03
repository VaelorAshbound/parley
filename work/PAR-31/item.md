---
id: PAR-31
title: >-
  Share token would ride along on any console line written during an /s/:token
  request
phase: done
priority: low
origin: PAR-16
created: 2026-09-29T21:52:07Z
updated: 2026-10-03T07:50:20Z
---

Found verifying PAR-16. Workers attaches the full request URL ($workers.event.request.url) to every console line a request writes. Today /s/:token writes none, so no token lands in the logs, but any future log or uncaught error during a share view would hold it. Options: a test that /s/ SSR writes no console output, or a Workers Logs/tail filter. Check before T38.
