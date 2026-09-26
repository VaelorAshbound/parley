---
id: PAR-13
title: >-
  Rate limit the public share view (share.view and /s/*) per IP, with its own
  message
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T22:35:56Z
updated: 2026-09-25T22:35:56Z
---

T25 found it: share.view is public, so the per-user limit from T27 does not cover it. A 128-bit token cannot be guessed, but a burst of misses should cost nothing. The /s/$token loader shows any 4xx as the friendly 404, so a limit error there needs its own words.
