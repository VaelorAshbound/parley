---
id: PAR-12
title: "Phone: close the sidebar drawer after picking a draft from the history"
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-25T19:12:13Z
updated: 2026-09-25T19:12:13Z
---

Found by T22's fix agent: in the mobile drawer, clicking a history row doesn't call setOpenMobile(false). Check whether it closes on navigation anyway; if not, close it.
