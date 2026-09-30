---
id: PAR-41
title: "Accessibility details: run-together accessible names, unrounded separator value, 20 px More button, two Toggle Sidebar buttons"
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Start page headline and composer have messy accessible names
(QA area: sizes-feel)

- Steps: Take an agent-browser snapshot of / .
- Expected: h1 'Describe the deal. Watch the contract fill itself in.' The composer's action group has a clean name or none.
- Actual: h1 name 'Describe the deal. Watch the contractfill itself in.' (the space before the <em> is missing), and group 'Enterto startStart drafting'. There are also two 'Toggle Sidebar' buttons in a row: the 16px rail edge and the real button.
- Evidence: Snapshot: heading "Describe the deal. Watch the contractfill itself in." [level=1]; group "Enterto startStart drafting".
- Likely file: apps/web/src/features/empty-state/landing.tsx

### Panel separator announces an unrounded value (aria-valuenow 25.881000518798828)
(QA area: journeys)

- Steps: Focus the chat/document separator and press ArrowLeft until it stops.
- Expected: A rounded percentage, or aria-valuetext like '26 percent'.
- Actual: The snapshot shows separator value 25.881000518798828 (69.80599975585938 after reopening).
- Evidence: agent-browser snapshot lines 'separator [ref=e8] focusable: 25.881000518798828'
- Likely file: apps/web/src/routes/-components/shell/document-panel.tsx (resizable handle)

### Sidebar draft 'More' button (20x20) is below the 24px minimum target size
(QA area: sizes-feel)

- Steps: Measure 'More for <draft>' in the sidebar at 768 to 2560.
- Expected: At least 24x24 (WCAG 2.5.8).
- Actual: 20x20 on every desktop and tablet size (it is fine inside the phone drawer).
- Evidence: Overflow/target script: 'BUTTON 20x20 More for Mutual Non-Disclosure'.
- Likely file: apps/web/src/routes/-components/shell (sidebar draft row)

Also from the feel notes: the sign-in button's name is 'Sign in Last used' (the badge is inside it).

Done when: names read cleanly (h1, h2, composer group, 'Sign in' without 'Last used'), aria-valuenow is rounded, targets are at least 24 px, one Toggle Sidebar in the tab order.
