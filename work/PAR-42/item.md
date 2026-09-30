---
id: PAR-42
title: >-
  Change marker cuts the new value to a few characters at narrow widths; its
  title is the field hint, not the value
phase: build
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T16:11:02Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### The change marker cuts the new value to a few characters at narrow chat widths, with no way to read the rest
(QA area: sizes-feel)

- Steps: Draft with the Purpose change, at 1024x768 with the sidebar open, or at 375x667 on the Chat tab.
- Expected: You can read the new value (it wraps, or a tooltip or aria gives the full value).
- Actual: 1024: 'Purpose → Sharing ...' (7 characters). 375: 'Sharing our pro...'. The li's title (its tooltip, and also its accessible name) is the field hint 'What the shared information may be used for.', not the value.
- Evidence: qa/sizes-feel/draft-1024.png, qa/sizes-feel/draft-375.png. Snapshot: listitem "What the shared information may be used for."
- Likely file: apps/web/src/features/chat (marker component)

Done when: the full new value can be read (tooltip/expand) and the accessible name includes it.
