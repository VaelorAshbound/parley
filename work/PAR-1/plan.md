# Implementation Plan: Parley

> Status: draft for review · Work item: PAR-1 · Spec: [spec.md](spec.md) · Tasks: [todo.md](todo.md)

## Overview

We build Parley in thin vertical slices. The riskiest unknowns come first: PDF and DOCX on Workers, and tests in Workers Builds. Next comes the pure document engine, which the whole app depends on. Then the "wow" path end to end, where a guest drafts an NDA by chat with the live document, before accounts, billing, the other 11 documents, and the deep test suites. Every task ships with its own tests (TDD). Phase 7 adds the extra depth the spec asks for.

## Architecture decisions (from the spec, plus the new ones)

1. **One Worker.** `src/server.ts` sends `/api/*` to Hono (Better-Auth + oRPC) and everything else to TanStack Start SSR. It also runs `scheduled()` for the cron jobs. An ADR is written in T6.
2. **The document engine is pure and built first.** Templates are parsed at build time. One `RenderedDocument` model feeds the React preview, the PDF HTML and the DOCX. Nothing in the UI can go ahead of the engine.
3. **The server owns the draft state.** The AI's tool calls and your manual edits both go through one `applyFieldChanges` function, which checks them with Zod, saves them, and returns the change set. The client only mirrors that state. The undo stack stores the inverse change sets.
4. **The fake LLM is shared by tests.** It is a scripted `MockLanguageModel`, used by the Worker tests, component tests and fast e2e, so those are fast and give the same result every run. The real `openai/gpt-6-luna` runs in evals, `test:real` and nightly.
5. **Cover pages are written from the template, not guessed.** The fields of each of the 11 cover pages come from the terms linked in its template, together with that template's definitions section. A coverage test makes sure every linked term is filled by a field.
6. **Where files go.** Plan artifacts live in `work/PAR-1/`, as CLAUDE.md says, not in `tasks/`. `/build` reads this plan and `todo.md` from here.

## Dependency graph

```
T1 scaffold ──┬─ T2 PDF/DOCX spike ─────────────────────────────┐
              ├─ T3 CI spike (Workers Builds) ──► all later CI  │
              └─ T5 parser ─► T6 fields+render ─► T7 NDA ─┬─► T8–T11 other 11 docs (parallel)
                                                          └─► T12 HTML+DOCX builders ◄┘
T4 brand (owner) ─────────────────────────────► T15 app shell
T1 ─► T13 DB ─► T14 worker+auth(guest)+oRPC ─► T15 shell ─► T16 live preview + manual edit
                                               └────────────► T17 AI chat ─► T18 wow motion ─► T19 quick replies/guardrails ─► T20 evals v1
T14 ─► T21 sign-in+link ─► T22 sidebar history ─► T23 settings
T12+T21 ─► T24 export ─► T25 share ─► T26 Polar
T17 ─► T27 limits · T13 ─► T28 cron · T14 ─► T29 observability
T8–T11 + T20 ─► T30 AI for all 12 ─► T31 real export of all 12
everything ─► Phase 7 depth (T32–T36) ─► Phase 8 launch (T37–T40)
```

## Phases

| Phase | Tasks | Goal |
|---|---|---|
| 0. Prove the risky bits | T1–T3 | Scaffold runs, PDF/DOCX work on Workers, and tests run in Workers Builds. **The go/no-go point for the fallbacks.** |
| 1. Brand + document engine | T4–T12 | Brand approved by you. All 12 documents render to preview, HTML and DOCX, fully tested. |
| 2. The wow path | T13–T20 | A guest drafts an NDA by chat, with the live document, shimmer and undo. **Demo to you.** |
| 3. Accounts | T21–T23 | Sign-in keeps the guest's draft. Sidebar history and search. Settings. |
| 4. Export, share, billing | T24–T26 | PDF/DOCX, share links, Polar sandbox Pro. |
| 5. Cost and abuse | T27–T29 | Turnstile, rate limits, AI budgets, guest cleanup, logs and metrics. |
| 6. All 12 in chat | T30–T31 | The AI drafts all 12 documents well. Real exports of all 12. |
| 7. Test depth | T32–T36 | Full e2e, real-service and nightly runs, coverage and mutation gates, performance, exploratory QA. |
| 8. Launch | T37–T40 | Empty-state polish, production on `parley.runtimedrift.dev`, README + ADRs, `/ship`. |

Checkpoints come after each phase (see todo.md). At the checkpoints after Phases 0, 2 and 6, I stop and ask for your review.

## What you need to do (owner actions)

| When | What |
|---|---|
| Before T3 | Create the GitHub repo, or let me create it with `gh`, **public or private?** Connect it to Workers Builds in the Cloudflare dashboard. |
| Before T2 | Cloudflare account on Workers Paid ($5/mo, needed for Browser Run). |
| T4 | The brand session: approve the colors, logo and type. |
| Before T13 | A Neon project (free tier). |
| Before T17 | Two OpenRouter keys with hard limits: **app** ($20/mo) and **test** ($10/mo). |
| Before T21 | A Resend account with the domain `runtimedrift.dev` verified. Google and GitHub OAuth apps. |
| Before T26 | Polar sandbox org + access token. |
| Before T38 | Confirm `runtimedrift.dev` is a zone on this Cloudflare account. |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `docx` doesn't run in workerd | Med | T2 spike. Fallback: build the DOCX in the browser from the same render model. |
| Playwright can't run in Workers Builds | Med | T3 spike. Fallback: add GitHub Actions for the test jobs only, after asking you. Deploy stays on Workers Builds. |
| Vite+ RC breaks something | Med | Pin the exact version. Fallback: plain Vite, Vitest, oxlint and oxfmt, with an ADR. |
| The cover pages we write are legally weak | High (trust) | Each field's wording comes from the template's own definitions. A "Cover page by Parley" label. A review pass against Common Paper's public docs for each document. |
| `gpt-6-luna` misses the eval bar | Med | Tune the prompts and tool descriptions first. If it still misses, bring it to you (don't swap the model silently). |
| Prompt injection that burns budget | Med | Guardrails + evals + per-user budget + the hard key limit. |
| The live-document motion causes jank on long documents | Med | Virtualize the preview if needed. Budget: no long tasks over 50 ms while streaming (DevTools trace in T35). |
| The Cloudflare Workers test plugin doesn't support Vitest 5 yet (Vite+ ships 5.0.1) | Med | The Worker tests go in their own package on Vitest 4.1 (T1). A `wi` item tracks moving them back once cloudflare/workers-sdk#15500 ships. |
| The 20-minute Workers Builds timeout | Low | Split the suites into shards, and keep the heavy runs nightly. |

## Open questions

1. **The GitHub repo: public from day one?** I recommend public. Recruiters see the real commit history, and the history is part of the showpiece.
