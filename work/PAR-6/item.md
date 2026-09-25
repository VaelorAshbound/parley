---
id: PAR-6
title: Draft page scrolls sideways when the document panel is closed
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T07:47:31Z
updated: 2026-09-25T07:47:31Z
---

Found in T19. With the document panel closed (`?panel=closed`), the draft page is 1368 px wide in a 1280 px window, so it can scroll sideways. The overflow is not in the resizable panel group (clipping it changes nothing) and not in `main` layout (it is 1024 px wide). `main`'s scrollWidth is 1112 vs 1024. Start from the collapsed document panel (its header and the `px-9` scroller sit at x 1280-1352).

Done when: no draft page scrolls sideways at 1440, 1280 and 390 px, panel open or closed, and an e2e test checks `scrollWidth === clientWidth` there (T32 can own the test).
