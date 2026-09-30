---
id: PAR-40
title: >-
  PDF prints an empty optional field as its placeholder, e.g. '[MNDA
  modifications]'
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### PDF prints an empty optional field as its placeholder '[MNDA modifications]'
(QA area: journeys)

- Steps: Leave MNDA Modifications empty, fill both parties, then Download > PDF.
- Expected: A finished contract says 'None.' (or leaves the section blank), not an editor placeholder in brackets.
- Actual: Page 1 shows 'MNDA Modifications' then '[MNDA modifications]'.
- Evidence: qa/journeys/50-pdf-p1.png, dl/nda.pdf (4 pages, 112 KB)
- Likely file: packages/documents (PDF/HTML render of empty optional fields)

Done when: an empty optional field prints blank (or the clause is left out) in PDF and DOCX; export test.
