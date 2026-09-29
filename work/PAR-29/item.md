---
id: PAR-29
title: "Phone: close the drawer after New draft in the sidebar"
phase: backlog
priority: low
origin: PAR-12
created: 2026-09-29T21:46:59Z
updated: 2026-09-29T21:46:59Z
---

Found by PAR-12: the sidebar "New draft" button (apps/web/src/routes/-components/shell/app-sidebar.tsx) links without closing the phone drawer. Same one-line fix: setOpenMobile(false) on click.
