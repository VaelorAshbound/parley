---
id: PAR-56
title: "Nightly stays green: performance budgets from the US runner, eval bar vs model variance"
phase: backlog
priority: low
origin: PAR-1
created: 2026-10-01T21:05:56Z
updated: 2026-10-01T21:05:56Z
---

First full nightly (2026-10-01, run 36924272640):
- performance: scripted first token p50 1504 ms vs a 1500 ms budget, from GitHub's US runner while the 6-browser e2e loaded the same Preview; Lighthouse warnings only. Options: run perf after e2e (needs: or a different hour), budgets for a US runner, or measure from Europe (PAR-27 was cancelled; revisit).
- evals: 36/36 passed but 1 invalid write (an askQuestions input that didn't validate; the model recovered). Bar is 0. Options: allow 1 per run with a trend, or tighten the askQuestions schema/prompt so the model can't produce the invalid shape.
