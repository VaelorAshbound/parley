---
id: PAR-35
title: "Questionnaire focus: a text step leaves focus on the fieldset (typing is lost) and Send answers drops focus to body"
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Questionnaire: moving to a text step leaves focus on the fieldset, so typing goes nowhere
(QA area: journeys)

- Steps: Real model, NDA details set. Step 1: click 'Delaware' (or press A). Step 2 'Which city or county should courts be in?' appears. Type 'Wilmington' and press Enter.
- Expected: The step's text box gets focus when the step appears, so keyboard users can go on typing (the card promotes keyboard use with its letter shortcuts).
- Actual: document.activeElement is the FIELDSET, not the input. The typed text and Enter are lost, and the step stays on 2 of 4 until you click the box.
- Evidence: qa/journeys/75-q2.png, 76-q3.png. eval activeElement = 'FIELDSET Which city or county should courts be in'. Possibly related to PAR-30 (keyboard golden path never sends).
- Likely file: apps/web/src/features/chat/ai-questionnaire.tsx

### Sending questionnaire answers drops keyboard focus to <body>
(QA area: sizes-feel)

- Steps: 1440, draft open. Type 'Please ask me about the term.' and press Enter. Press A for 1 year, Tab, type 'Acme Robotics', Enter. On step 3, Tab to Skip and press Enter.
- Expected: Focus moves somewhere useful: the composer, or the 'Key terms answered' summary.
- Actual: document.activeElement is BODY. The next Tab starts again from 'Skip to content'.
- Evidence: Focus log after Skip: 'BODY Skip to contentParleyToggle Sidebar... rect 0,0 1440x900'. Screenshot qa/sizes-feel/kb-after-skip.png.
- Likely file: apps/web/src/features/chat (questionnaire component)

Done when: moving to a text step focuses its input, and after Send answers focus goes to the composer (or the next sensible control); keyboard e2e. Check PAR-30 against this.
