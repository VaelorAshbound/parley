---
id: PAR-23
title: test:real robustness, and check the PDF title's optical size
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-28T17:21:40Z
---

- print.ts: Promise.all rejects on the first failed print and disposes the proxy while others run; use allSettled (or a small concurrency limit), report every failure, dispose after all settle. Check 11 parallel prints stay under Browser Run's rate limit.
- REAL_REUSE=1: check the files exist and say so clearly.
- Static Newsreader has one optical size: the 22 pt title may now use the text cut. Compare one title with brand.md; if it matters, embed Newsreader Display (or the 36pt cut) for h1.
