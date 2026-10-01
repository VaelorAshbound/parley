# Checkpoint: Complete (PAR-1)

Every success criterion in spec §8, with its evidence. Checked 2026-10-01 on production 6075421 and later (parley.runtimedrift.dev), v1.0.0.

Verdict for each criterion: ✅ met, ⚠️ met with a recorded exception, ❌ not met.

## User (live app)

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| A guest finishes a Mutual NDA from the landing page in under 2 minutes, and a PDF downloads right after sign-in. | ✅ | Timed 2026-10-01 with the real model (`gpt-6-luna`), driven by a Playwright script on local dev with the same code as production (production's Turnstile blocks automated browsers). The steps: describe the deal, answer the questionnaires, the NDA completes, then sign up and download the PDF. The PDF downloaded **92 s** after the page loaded, sign-up included (T39 demo recording). The owner's own production turns worked (T38). |
| All 12 documents can be picked by chat, filled, previewed and exported as PDF and DOCX. | ✅ | **Chat:** evals 2026-10-01 picked the right agreement in 100% of 36 conversations across all 11 agreements (the 12th document, the NDA cover page, comes with the Mutual NDA), and every draft finished. **Export:** `pnpm test:real:export` printed all 12 documents with real Browser Run and built them as Word files, read them back word for word, and compared every PDF page with the approved images: **44/44 passed** in Playwright's image. The nightly run had failed 3 DPA checks because the test still expected PAR-40's old placeholder text; the test now uses the printer's own "None." rule, and DPA page 7's image was re-approved. The PDF looked right (tagged, 4 pages for the NDA) in the T39 check. |
| A field changes in the preview within 100 ms of the tool call arriving. No layout shift, no flash. | ⚠️ | Measured on the Preview (production build, scripted AI, 10 runs), from the tool-result chunk reaching the browser to the value in the live document: **median 15 ms**. 7 runs were under 25 ms; 3 took 244–386 ms (cause not yet found; filed). T17: no long tasks while streaming. **Layout shift:** PAR-48 is open (the document panel moves up about 28 px while the AI fills the last fields). Lighthouse CLS on the public pages is 0–0.009. |
| First AI token in under 1.5 s (p50) and under 3 s (p95). | ⚠️ | T35: the real `gpt-6-luna` on the Preview took p50 4.0 s and p95 4.8 s. The Worker, database and stream part takes p50 0.8 s; the rest is the model thinking. **The owner accepted this on 2026-09-29** (todo.md T35). |
| Landing page: LCP under 2.0 s on 4G, CLS under 0.05, Lighthouse 95 or more in every category. | ✅ | Production Lighthouse 2026-10-01 (phone, 4G, median of 3): `/` scored performance 98, accessibility 100, best practices 100, SEO 100, with LCP 1.67 s and CLS 0.009. `/pricing` and `/sign-in` scored the same (98/100/100/100, LCP 1.7–1.8 s, CLS 0). The sign-in LCP miss from T35 (2.4–3.3 s on a Preview) doesn't show on production. |
| Works in the latest Chrome, Firefox and Safari, and at 375 px wide. | ⚠️ | The e2e suite (2026-10-01, run 36924266491) in 6 projects against the Preview: **Chromium, Firefox, Chromium phone, Firefox phone and WebKit phone (375 px) all passed in full.** Desktop WebKit had 1 failed and 3 flaky tests, all "Page crashed": the WebKit process dies on draft pages with the panel open, both in CI and in a local container, on a different test each time. Real Safari on a Mac is not checked (filed). The axe checks pass in every project. |

## Engineer (repo)

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Types are strict from the DB to the UI (no `any`). `pnpm check` is clean. | ✅ | `pnpm check` is clean (466 files: format, lint and type-aware lint). There is no `any` in hand-written code. The only matches are TanStack Router's generated `routeTree.gen.ts` and one comment. |
| Unit, integration and e2e tests are green in CI. The eval score is shown in the README. | ✅ | `pnpm test` 1,306 passed and 1 skipped. `pnpm test:workers` 450 passed. CI was green on PRs #3, #4 and #6 (component, e2e Chromium, Workers Builds); one timing flake on #6 passed on re-run, noted on PAR-8. The README shows the evals from 2026-10-01: 100% / 100% / 0 invalid writes, $0.0033 per NDA. |
| README: ~~a 30-second GIF~~, an architecture diagram, "how it works", and a local setup in 3 or fewer commands. | ✅ | The GIF was dropped by the owner on 2026-10-01. The README has the diagram (light and dark, checked on GitHub) and "How it works". Local setup is `git clone`, `pnpm install`, `pnpm dev`: on a fresh clone in a clean podman container, with no keys and no login, a guest's message filled a live NDA (T39). |
| ADRs exist for these decisions: server entry, document engine, PDF through Browser Run, guest auth, cost limits. | ✅ | ADR-0002, ADR-0003, ADR-0010, ADR-0011 and ADR-0012 cover them, among 12 ADRs in total. |

## Exec (cost)

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| The only fixed cost is the Workers Paid plan ($5/mo). Neon scales to zero, and nothing else costs money while idle. | ✅ | Neon's production endpoint scales to zero (autoscaling from 0.25 CU, suspends when idle). OpenRouter, Browser Run, Resend and Polar (sandbox) are billed per use or are free tiers. The daily cron wakes Neon for about 5 minutes once a day (ADR-0012, cron.ts). |
| The AI spend can't go past the OpenRouter key limit, whatever the traffic. | ✅ | OpenRouter's key API, 2026-10-01: the app key has a $10 limit with no reset ($0.02 used), and the test key has a $5 limit with no reset. Previews and CI use the test key. On top of that: a per-call output cap, per-user rate and daily limits, and a guest limit per network (ADR-0012, tightened in T40). |
| Cost per finished NDA is measured and shown in the README (goal under $0.02). | ✅ | $0.0033 (evals 2026-10-01, 4 NDA conversations), shown in the README. |

## Result

**Checkpoint passed with four recorded exceptions.** 8 criteria are met in full. The other four:

1. **First AI token** is 4.0 s against 1.5 s. The owner accepted this in T35.
2. **Live update within 100 ms:** median 15 ms, with occasional runs at 250–390 ms, and the PAR-48 shift is still open.
3. **Desktop Safari:** WebKit crashes on Linux and real Safari isn't checked yet. The WebKit phone project passes.
4. **The GIF** was dropped by the owner.

None of these blocks v1.0.0, which is live.

**Nightly, 2026-10-01 (run 36924272640), the first run with everything on:**
- **production:** passed (real Turnstile, smoke on the live site).
- **export:** failed on the stale DPA test. It is fixed now, and the same suite passed 44/44.
- **evals:** 36/36 conversations passed, but there was 1 invalid write (the model sent questionnaire input that didn't validate, then recovered). The bar is 0, and the same suite gave 0 locally that day. It wasn't the output cap: the call ended on a tool call at 1,453 tokens.
- **performance:** failed. Time to first token with the scripted AI was p50 1,504 ms against a 1,500 ms budget, measured from GitHub's US runner while 6 e2e browsers loaded the same Preview. Lighthouse showed warnings only. This is the US-runner effect PAR-27 described.

**Follow-ups filed:** PAR-54 (desktop WebKit crashes; a check in real Safari), PAR-55 (slow live-update outliers), PAR-56 (a nightly that stays green: performance budgets from the US runner, and the eval bar of 0 against model variance). PAR-48 covers the panel shift.
