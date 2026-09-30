---
id: PAR-32
title: >-
  Live document keeps the template value after the first message while the chat
  marker shows the AI's value
phase: backlog
priority: high
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Live document sometimes keeps the template default after the first message, while the chat marker shows the AI's new value
(QA area: sizes-feel)

- Steps: Fresh guest (clear cookies, set parley-scripted-ai=1), 1440x900. On /, type 'We are sharing our product roadmap with a supplier, Acme Robotics.' and press Enter. Wait about 12 s. Compare the chat marker with the Purpose field in the document.
- Expected: The document's Purpose inks in 'Sharing our product roadmap with a vendor.', the same value the chat marker shows (this is the wow moment in spec §1).
- Actual: In 2 of 4 runs the document kept 'Evaluating whether to enter into a business relationship with the other party.' (the mutual-nda.ts default), with the highlighter and the change bar on it. The chat marker said 'Purpose → Sharing our product roadmap with a vendor.' A reload shows the right value, so the server saved it; only the client cache is stale. The chip start ('Sharing a roadmap with a supplier') was right in 1 run.
- Evidence: Screenshot: qa/sizes-feel/draft-1440.png (wrong value) and draft-1440-reload.png (right value after reload). Poll log: 'run 2 step 3..8: "to enter into a business relationship with the other party."' while the chat text had 'Purpose → set to Sharing our product roadmap with a vendor.' No console errors. Likely cause (from reading the code): in use-document-sync.ts, tool-chooseDocument calls invalidateQueries (a refetch starts), then tool-updateFields calls setQueryData. If the refetch answer was read before updateFields was saved, it lands later and overwrites the value set by setQueryData. Possible fix: await or cancel the refetch (cancelQueries) before setQueryData, or invalidate again after the turn finishes.
- Likely file: apps/web/src/features/chat/use-document-sync.ts

Done when: the first message's field changes show in the document every time (race between the chooseDocument refetch and updateFields setQueryData in use-document-sync.ts), with a test that forces the refetch to land late.
