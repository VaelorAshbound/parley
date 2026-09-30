---
id: PAR-46
title: Composer drops Enter without a word while Parley is still answering
phase: backlog
priority: medium
origin: PAR-35
created: 2026-09-30T17:40:48Z
updated: 2026-09-30T17:40:48Z
---

Found by the QA-fixes wave (PAR-35 lane, review). While a turn is running (busy), Enter in the reply box does nothing and says nothing; the text stays. Keyboard users get no signal but the Stop button. It caused PAR-30's flaky golden path, and since PAR-35 puts the cursor in the reply box right after Send answers, people will hit it more.

Options: queue the message and send it when the turn ends, or show a short "Parley is still answering" hint by the box.

Done when: Enter while busy either sends after the turn or tells the user why it waits; test in composer or chat-panel browser tests.
