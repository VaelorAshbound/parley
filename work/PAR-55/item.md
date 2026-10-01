---
id: PAR-55
title: "Live document: a few updates take 250-390 ms after the tool result (median 15 ms)"
phase: backlog
priority: low
origin: PAR-1
created: 2026-10-01T21:05:56Z
updated: 2026-10-01T21:05:56Z
---

Final checkpoint measure (Preview, production build, scripted AI, 10 runs): time from the tool-output chunk reaching the browser to the value in the live document: 10.9, 11, 11.8, 13.1, 14.2, 16.5, 23.5, 244, 247, 386 ms. Spec §8 asks for 100 ms. Guess to check first: the chosen agreement's definition chunk loads on first show, so the value waits for it (preload on chooseDocument's tool input). Measure with a fetch tee + MutationObserver (script in the T39/T40 session notes).
