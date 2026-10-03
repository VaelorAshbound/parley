---
id: PAR-48
title: >-
  Document panel shifts up ~28 px while the AI fills fields near the end of the
  page (header cut, gap at bottom)
phase: backlog
priority: medium
origin: PAR-1
created: 2026-10-01T19:17:33Z
updated: 2026-10-01T19:17:33Z
---

Seen while recording the README GIF (T39), 1280x800, Chromium, local dev, real model.

- During a reply, after the AI writes the signature-table fields (bottom of the cover page), the whole document panel moves up about 28 px: its header ("Mutual NDA", Share, Download) is half cut off at the top, and a strip of empty ground shows at the bottom.
- It stays like that until a reload. After sign-up (a fresh page load) the layout is right.
- Likely cause to check first: scrolling the changed field into view scrolls an ancestor that should never scroll (an overflow-hidden wrapper of the panel), not only the document's own scroller.
- Screenshot: work/PAR-1/qa/panel-shift.png.

Done when: an e2e test fills a field at the end of the document and the panel's header stays at y=0.
