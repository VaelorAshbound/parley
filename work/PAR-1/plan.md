# Implementation Plan: Parley

> Status: approved 2026-09-23 · Work item: PAR-1 · Spec: [spec.md](spec.md) · Tasks: [todo.md](todo.md)

## Overview

We build Parley in thin vertical slices. The riskiest unknowns come first: PDF and DOCX on Workers, and tests in Workers Builds. Next comes the pure document engine, which the whole app depends on. Then the "wow" path end to end, where a guest drafts an NDA by chat with the live document, before accounts, billing, the other 11 documents, and the deep test suites. Every task ships with its own tests (TDD). Phase 7 adds the extra depth the spec asks for.

## Architecture decisions (from the spec, plus the new ones)

1. **One Worker.** `src/server.ts` sends `/api/*` to Hono (Better-Auth + oRPC) and everything else to TanStack Start SSR. It also runs `scheduled()` for the cron jobs. An ADR is written in T6.
2. **The document engine is pure and built first.** Templates are parsed at build time. One `RenderedDocument` model feeds the React preview, the PDF HTML and the DOCX. Nothing in the UI can go ahead of the engine.
3. **The server owns the draft state.** The AI's tool calls and your manual edits both go through one `applyFieldChanges` function, which checks them with Zod, saves them, and returns the change set. The client only mirrors that state. The undo stack stores the inverse change sets.
4. **Scripted AI for tests, at two layers.**
   - **Server:** AI SDK `MockLanguageModel` in the Worker tests and the fast e2e.
   - **Client:** `@shadcn/helpers/ai-sdk` `createChat()` swapped in as the `useChat` transport for component tests and dev states. It streams through the real `useChat` lifecycle, with no network.

   Both are fast and give the same result every run. The real `openai/gpt-6-luna` runs in evals, `test:real` and nightly.
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
                                               └────────────► T17 AI chat ─► T18 wow motion ─► T19 questionnaire/guardrails ─► T20 evals v1
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

## Skills per task

Loaded skills are binding workflows (CLAUDE.md). At the start of each task, **load every skill in its row**, follow them, and name them in the task's commit/log. **Process** skills come from `agent-skills`, and **domain** skills are routed by `using-stack-skills`.

**Always on, for every task:**
- process: `incremental-implementation`, `test-driven-development`, `source-driven-development` (check APIs in the docs before coding), `git-workflow-and-versioning` (every commit);
- `observability-and-instrumentation` whenever logs or metrics are touched;
- `doubt-driven-development` for decisions that are hard to reverse (schema, auth, billing, money paths);
- before each checkpoint: `code-review-and-quality` → `code-simplification` (`/review`, `/code-simplify`).

| Task | Process skills | Domain skills |
|---|---|---|
| T1 Scaffold | `context-engineering` | `shadcn` (monorepo init), `cloudflare:wrangler`, `cloudflare:workers-best-practices`, `cloudflare:cloudflare` |
| T2 PDF/DOCX spike | `debugging-and-error-recovery` if it fails | `cloudflare:wrangler`, `cloudflare:cloudflare` (Browser Run), `anthropic-skills:pdf`, `anthropic-skills:docx` (to check the output files) |
| T3 CI spike | `ci-cd-and-automation`, `browser-testing-with-devtools` | `cloudflare:wrangler`, `neon:neon-postgres-branches` |
| T4 Brand | `frontend-ui-engineering` | `emil-design-eng`, `apple-design`, `shadcn` (theme/preset), `web-design-guidelines`, `animation-vocabulary` |
| T5–T7 Parser, fields, NDA | `api-and-interface-design` | — (pure TS) |
| T8–T11 Cover pages | `doubt-driven-development` (legal wording) | `firecrawl:firecrawl-scrape` / `firecrawl:firecrawl-search` (Common Paper's public docs) |
| T12 HTML + DOCX output | — | `anthropic-skills:docx`, `anthropic-skills:pdf`, `cloudflare:workers-best-practices` |
| T13 DB | `api-and-interface-design` | `neon:neon`, `neon:neon-postgres`, `neon:neon-postgres-branches`, `cloudflare:wrangler` (Hyperdrive) |
| T14 Worker API + guest auth | `api-and-interface-design`, `security-and-hardening` | `cloudflare:workers-best-practices`, `better-auth-best-practices`, `create-auth` |
| T15 App shell | `frontend-ui-engineering` | `shadcn`, `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines`, `apple-design` |
| T16 Live preview + field editor | `frontend-ui-engineering` | `shadcn` (Field, ToggleGroup, Combobox), `vercel-composition-patterns`, `vercel-react-best-practices` |
| T17 AI chat | `api-and-interface-design` | `ai-sdk`, `shadcn` (chat primitives, `@shadcn/helpers/ai-sdk`), `cloudflare:workers-best-practices` |
| T18 Wow motion | `frontend-ui-engineering` | `emil-design-eng`, `apple-design`, `find-animation-opportunities`, `animation-vocabulary`, `review-animations`, `shadcn` (shimmer, Marker) |
| T19 Questionnaire + guardrails | `security-and-hardening` (prompt injection) | `ai-sdk`, `shadcn` (Questionnaire) |
| T20 Evals v1 | — | `ai-sdk`, `dataviz` (eval report charts) |
| T21 Sign up/in + linking | `security-and-hardening` | `better-auth-best-practices`, `create-auth`, `email-and-password-best-practices`, `better-auth-security-best-practices`, `cloudflare:turnstile-spin`, `resend:resend`, `resend:react-email`, `resend:email-best-practices` |
| T22 Sidebar history + search | `performance-optimization` | `neon:neon-postgres`, `shadcn` (Sidebar, Command), `vercel-react-best-practices` |
| T23 Settings + account flows | `security-and-hardening` | `better-auth-best-practices`, `email-and-password-best-practices`, `better-auth-security-best-practices`, `resend:react-email`, `shadcn` |
| T23b Two-factor | `security-and-hardening` | `two-factor-authentication-best-practices`, `better-auth-security-best-practices`, `shadcn` (InputOTP) |
| T24 Export + quota | `doubt-driven-development` (money path) | `cloudflare:cloudflare` (Browser Run), `anthropic-skills:pdf`, `anthropic-skills:docx` |
| T25 Share links | `security-and-hardening` | `cloudflare:workers-best-practices`, `shadcn` |
| T26 Polar | `doubt-driven-development` (billing) | `better-auth-best-practices` (Polar plugin), `resend:resend` (receipts, if any) |
| T27 Limits | `security-and-hardening` | `cloudflare:turnstile-spin`, `cloudflare:workers-best-practices`, `better-auth-security-best-practices` |
| T28 Cron | — | `cloudflare:wrangler`, `cloudflare:workers-best-practices`, `neon:neon-postgres-egress-optimizer` |
| T29 Observability | `observability-and-instrumentation` | `cloudflare:cloudflare` (Workers Observability/Traces) |
| T30 AI for all 12 | — | `ai-sdk`, `dataviz` |
| T31 Real export of all 12 | `browser-testing-with-devtools` | `anthropic-skills:pdf`, `anthropic-skills:docx` |
| T32 Full e2e + a11y | `browser-testing-with-devtools` | `agent-browser`, `web-design-guidelines` |
| T33 Real-service + nightly | `ci-cd-and-automation` | `neon:neon-postgres-branches`, `cloudflare:wrangler`, `resend:resend-cli` |
| T34 Coverage + mutation | `code-review-and-quality` | — |
| T35 Performance | `performance-optimization` | `cloudflare:web-perf`, `vercel-react-best-practices`, `neon:neon-postgres`, `neon:neon-postgres-egress-optimizer`, `improve-animations` |
| T36 Exploratory QA | `browser-testing-with-devtools`, `debugging-and-error-recovery` | `agent-browser`, `anthropic-skills:chrome-browser` (Claude in Chrome), `web-design-guidelines`, `review-animations` |
| T37 Empty-state polish | `frontend-ui-engineering` | `emil-design-eng`, `apple-design`, `shadcn` (Empty), `find-animation-opportunities` |
| T38 Production | `shipping-and-launch`, `security-and-hardening` | `cloudflare:wrangler`, `cloudflare:cloudflare` (custom domain, WAF), `neon:neon`, `resend:email-best-practices` (SPF/DKIM/DMARC) |
| T39 README + ADRs | `documentation-and-adrs` | `dataviz` (charts), `artifact-diagramming` (architecture diagram) |
| T40 Ship | `shipping-and-launch` (`/ship`) | — |

Skills that aren't used, and why:
- `organization-best-practices`: teams are out of scope.
- `cloudflare:durable-objects`, `cloudflare:agents-sdk`, `cloudflare:sandbox-sdk`, `cloudflare:cloudflare-one*` and `cloudflare:cloudflare-email-service`: Resend is our email service.
- `neon:neon-auth`: we use Better Auth.
- `neon:neon-ai-gateway`: we use OpenRouter.
- `neon:neon-functions` and `neon:neon-object-storage`: not needed.
- `resend:agent-email-inbox`: there is no inbound email.
- `pick-ui-library` / `prototype`: only when you ask for them.

## What you need to do (owner actions)

| When | What |
|---|---|
| Before T3 | Create the **private** GitHub repo, or let me create it with `gh`. Connect it to Workers Builds in the Cloudflare dashboard. |
| Before T2 | Cloudflare account on Workers Paid ($5/mo, needed for Browser Run). |
| T4 | The brand session: approve the colors, logo and type. |
| Before T13 | A Neon project (free tier). |
| Before T17 | ✅ Done: `OPENROUTER_API_KEY` (app, hard limit $10) and `OPENROUTER_API_KEY_TEST` (test, hard limit $5), both total caps with no reset. |
| Before T21 | ✅ Resend: `mail.runtimedrift.dev` verified, `RESEND_API_KEY` in `.env` (full access; make a sending-only key for production in T38). ✅ Google OAuth client (prod + localhost:3000) and GitHub OAuth apps "Parley" + "Parley (dev)", credentials checked. |
| Before T26 | ✅ Polar sandbox org `parley-legal`, product "Parley Pro" ($5/month recurring), `POLAR_ACCESS_TOKEN` + `POLAR_PRO_PRODUCT_ID` in `.env`, checked through the API. The webhook endpoint gets added in T26 (`polar listen` locally, then the live URL). |
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

None.

**Decided:** the GitHub repo is **private** (owner, 2026-09-23). It can be made public later, and the commit history comes along.
