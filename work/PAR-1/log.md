### 2026-09-22T20:46:09Z
Created.

### 2026-09-22T20:46:24Z
Interview done. Intent confirmed and saved in intent.md. Next: /spec.

### 2026-09-23T16:07:45Z
Spec approved (work/PAR-1/spec.md). Next: /plan, with Phase 0 spikes for PDF/DOCX on Workers and tests in Workers Builds.

### 2026-09-23T17:11:01Z
Owner setup: Workers Paid confirmed via API; account token active; private repo github.com/VaelorAshbound/parley created, main + PAR-1-parley pushed. Workers Builds connection waits for T1 (needs a Worker). Plan awaiting approval.

### 2026-09-23T17:12:46Z
Confirmed zone runtimedrift.dev is active on this Cloudflare account (Free plan); parley.runtimedrift.dev custom domain ready for T38.

### 2026-09-23T17:19:32Z
Owner created Neon project parley (aws-eu-central-1, db neondb, owner-set scaling: do not change). .env: DATABASE_URL=direct, DATABASE_URL_POOLED=pooled. Spec updated.

### 2026-09-23T17:27:11Z
OpenRouter keys added: app ($10 total cap) + test ($5 total cap), both verified active, no reset.

### 2026-09-23T17:31:01Z
Resend key added; mail.runtimedrift.dev verified (eu-west-1, sending). Next owner step: Google + GitHub OAuth apps.

### 2026-09-23T17:49:30Z
OAuth ready: Google client (prod+localhost:3000), GitHub prod+dev apps; GitHub creds validated via API.

### 2026-09-23T17:59:35Z
Polar sandbox ready: org parley-legal, product Parley Pro $5/mo, token verified. All owner setup done except webhook endpoint (T26).

### 2026-09-23T18:01:34Z
Plan approved (work/PAR-1/plan.md + todo.md). Session end. Finished: intent, spec, plan, all owner setup (Cloudflare, GitHub private repo, Neon, OpenRouter, Resend, OAuth, Polar). Next session: T4 brand design decisions (brand.md: palette, type, logo, motion/shimmer spec), then T1 scaffold via /build. Follow-ups filed: PAR-2 (Vitest 5 worker tests), PAR-3 (RLS), PAR-4 (Drizzle v1).

### 2026-09-23T18:48:22Z
phase: backlog -> build

### 2026-09-23T18:48:22Z
T4 design half done: Paper & Ink approved (brand.md, canvas https://claude.ai/artifact/98zhHMskM8kyTANrg8qHqj, source in design/). Decided: site says eleven agreements, home keeps example prompts + agreement list, dark mode has a dark document page. Next: T1 scaffold via /build, then T4 code half (tokens.css, logo.svg, dev.brand preview).

### 2026-09-23T18:49:13Z
Session end. Finished: T4 design half (Paper & Ink approved, brand.md, canvas, spec decisions). Commits 5a16d13 and 2339ab5 are local on PAR-1-parley, not pushed. Next session: T1 scaffold via /build, then T4 code half.

### 2026-09-23T19:32:03Z
T1 done (925ec51): Vite+ 1.0 RC monorepo, TanStack Start on one Worker, Hono /api, shadcn base-nova in packages/ui, workerd tests on Vitest 4.1. T2 done, GO for both (50f4784, cb8ae90): DOCX in workerd, PDF via real Browser Run, deployed to workers.dev, timed, then deleted; results in spikes.md. Branch pushed. Next: T3 waits for the owner to connect the repo to Workers Builds (settings proposed in chat), then Playwright on the Preview, R2 traces, nightly hook.

### 2026-09-24T01:40:57Z
T3 done: Workers Builds runs every gate + a Worker Preview per branch (~30 s). Browser tests moved to GitHub Actions (ADR-0001, owner's choice), lean on minutes. Red/green proven on PR #2. Repo made public (owner) after a secret scan. Draft PR #1 is open. At Checkpoint 0: waiting on owner review; merging PR #1 to main is the owner's call. Next: T4 code half, then T5.

### 2026-09-24T01:48:04Z
Checkpoint 0 approved by owner. Decision: PR #1 stays draft, merge to main after T12 (spike routes gone). Session end. Finished: T1 scaffold, T2 PDF/DOCX GO, T3 CI (Workers Builds + GitHub Actions E2E, ADR-0001), repo public. Next session: T4 code half (tokens.css, logo.svg, dev.brand page), then T5 template parser via /build.

### 2026-09-24T02:38:05Z
/build auto in progress. Done: T4 code half (cee400f: tokens, fonts, logo, /dev/brand), T5 parser (ba8605d, e6551ec: typed trees in generated/, 100% coverage gate in CI), T6 engine (f62a8de..dd57a4e: fields, defineDocument, applyFieldChanges with compare-and-set undo, render; ADR-0002, ADR-0003). Next: T7 Mutual NDA definition, then T8-T12.

### 2026-09-24T02:55:50Z
T7 (Mutual NDA, ba8ef9d) and T12 (print HTML + DOCX, spike removed, 1d6e02b) done; CI gate green, real Browser Run PDF passes. T8-T11 research saved in work/PAR-1/cover-research/. Blocked on owner decisions: official cover pages exist for all 10 docs, CSA template is unpublished v3, new field kinds needed.

### 2026-09-24T03:24:56Z
T7b done (field kinds + layout for official cover pages, 01df863..e73ac55). CSA switched to published v2.1 (c4e7643). Next: T8-T11 definitions mirroring Common Paper's official cover pages.

### 2026-09-24T04:15:53Z
Phase 1 done (T4-T12, Checkpoint 1). All 12 Common Paper documents are defined on their official cover pages (T8-T11, agents in parallel worktrees). Engine gaps they found are fixed and used everywhere: any definition is a DocumentDefinition, select works as a blank, and rules know their phase ("required when" on finished pages only). Print HTML + DOCX snapshots for every document. Gate: 596 tests, 100% coverage on packages/documents, also stable with each property test cut to one run. The owner approved the brand on /dev/brand.
Next: T13 (DB package: Neon + Hyperdrive; creates cloud resources, so confirm first). Open for the owner: push PAR-1-parley? Look at one DOCX in Word. Lawyer review of the judgment calls in work/PAR-1/cover-pages/*.md.

### 2026-09-24T19:16:59Z
Demo note done (08c79b6, 8153e9c): 'Parley demo · Not legal advice · Do not use for real agreements' on every PDF/DOCX page (DISCLAIMER constant); lawyer review dropped by owner. T13 done (bd7d203..262e78c): packages/db on real Postgres 18 via embedded-postgres (ADR-0004), 21 DB tests, db:check drift gate. Neon branch 'preview' + Hyperdrive parley/parley-preview (caching off), production migrated. Fixed: embedded-postgres exit hook made failing test runs exit 0. Next: T14 (auth) needs owner sign-off.

### 2026-09-24T19:58:04Z
T14 done (eef11d7..a082a3c): Better Auth guest sessions + oRPC drafts with owner checks, auth matrix, CSRF/body limits, secrets set (prod + previews). Live Preview read-after-write verified. Fixed a two-Vite-copies bundle bug; CI now boots the bundle. Follow-up PAR-5. Next: T15 app shell.

### 2026-09-24T20:35:46Z
Session end (context 70%). Finished: demo note on PDF/DOCX; T13 DB (Neon preview branch, Hyperdrive x2, real PG18 tests, ADR-0004); T14 guest auth + oRPC drafts (auth matrix, CSRF, limits, secrets set, live Preview check); T15 app shell (sidebar, resizable panel, phone tabs, SSR cookies, CLS 0, 14 e2e green in CI). Fixes on the way: exit-code bug from embedded-postgres, two Vite copies breaking the bundle, CI testing a stale Preview. Follow-up PAR-5. Next session: T16 live document preview + field editing via /build (load T16 skills from plan.md). Open for the owner: cross-model review offer for T14 auth (declined or not yet asked); look at the shell on the Preview.

### 2026-09-25T06:32:04Z
T16 done (inline editor, live preview, CI green). T17 done (AI chat over oRPC with tools, chooseDocument, drafts without an agreement via migration 0001 on Neon preview+production, OpenRouter secrets set). Real-model runs found and fixed: parallel tool calls overwriting, chat history dropped by validation, null parts wiping a party. Next: T18 wow motion.

### 2026-09-25T06:59:03Z
T18 done (6469449..342a87b, CI green): ink-in and change bars for AI changes, scroll to the changed field, choice swap with layout motion, Undo from the chat (compare-and-set, 'Changed since'), phone tab dot, reduced motion = color only. No long tasks while streaming; one 88-104 ms task on first draft-route open is the 1 MB draft chunk parse, left for T35. Not done: the Claude in Chrome feel check, moved to the Checkpoint 2 demo. Next session: T19 questionnaire + guardrails via /build (@shadcn/react already installed; add @shadcn/questionnaire in packages/ui with 'yes n |'), then T20 evals, then STOP at Checkpoint 2.

### 2026-09-25T07:48:00Z
T19 done (73b99c7..cea178e): guardrails + history budget, markComplete (engine missingFields, draft status), askQuestions browser tool + chat.answer with checked answers, the Paper & Ink questionnaire inline (letter keys, Other, skip, follow-ups, resume after reload). Real gpt-6-luna: full NDA via questionnaires, off-topic/injection/advice handled, prompt cache ~99.8%. Real-model fixes: nullable showIf, auto-send only after answers, page widening from truncated rows. Filed PAR-6, PAR-7. Next: T20 evals.

### 2026-09-25T08:51:03Z
T20 done (4308958..73290a7): pnpm evals, 16 real gpt-6-luna conversations through the real chat procedure in Node (11 agreement picks, 3 full NDAs with a simulated user, 2 guardrails); report in evals/report.md. Baseline 93%/75%/12 invalid; after product fixes (party title missing from the model's schemas, silent defaults, key hints, Other always offered, dotted keys) two runs of 100%/100%/0, ~$0.001 per conversation. Review before Checkpoint 2: CI was red (test Postgres out of connections, fixed); 7 review issues fixed with tests (answer lock, multi-questionnaire answers, history budget per part, status on switch, reserved names, id takeover, eval counting). CI green on 73290a7+. STOP at Checkpoint 2: owner demo. Dev server on :3001 (priced holds :3000).

### 2026-09-25T09:20:00Z
Demo: owner hit INVALID_ANSWERS (typed answers missing from a questionnaire). Not reproduced; added answers_refused log, recovery (chat reloads the server's copy, questionnaire comes back, typed progress kept until accepted), tests for mouse/Next paths (ae7c0e1, ca0c348). Root cause still open.

### 2026-09-25T09:31:00Z
Demo bug root cause: Firefox. The questionnaire library moves typed boxes in/out of the form via the form attribute; FormData follows the form owner, which Firefox didn't restore, so every typed answer was dropped (choices kept). Fixed by reading answers from the form's own inputs (d7a8545), with a test that drops a box's form owner. Found via the new answers_refused log + session user agent.

### 2026-09-25T09:32:52Z
Owner confirmed the Firefox questionnaire fix works.

### 2026-09-25T09:39:55Z
Checkpoint 2 passed (owner demo in Firefox). Decisions: complete card without Export until T24; Other always offered; component tests in Chromium + Firefox on PRs (110 green, 018bd18). Next: Phase 3, T21 sign up/in + guest linking (auth: owner sign-off first).

### 2026-09-25T09:46:35Z
Session end. Finished: T19, T20, the pre-checkpoint review fixes, the Firefox questionnaire fix, Firefox in CI, Checkpoint 2 passed. 21 of 42 tasks done. Next session: T21 via /build (auth: get owner sign-off first; load its skills from plan.md). Open follow-ups: PAR-6, PAR-7.

### 2026-09-25T10:31:03Z
Wave A paused (usage limit). Worktrees kept: -1=T21, -2=T29, -3=T30 under .claude/worktrees/wf_846f7275-6fb-*, base 8b86759; uncommitted edits may exist. Resume: new agents continue each task from its worktree (build, review, fix), then merge one by one. Script: workflows/scripts/par1-wave-a-wf_b15be26a-fcf.js in this session's dir.

### 2026-09-25T12:27:23Z
T29 + T30 merged (cff6c77), gate green, pushed. Owner approved setting T21's production secrets (RESEND_API_KEY, TURNSTILE_SECRET_KEY, GOOGLE_/GITHUB_CLIENT_ID/SECRET) when T21 merges.

### 2026-09-25T13:00:53Z
Wave A done and merged (c97eeb8): T21 accounts, T29 observability, T30 AI for all 12. Review caught a critical T21 bug (a confirmation link could move a guest's drafts to an attacker), fixed with a test. Gate green: check, 878 unit, 149 worker, e2e Chromium. Production secrets set (new sending-only Resend key parley-production-sending). Filed PAR-8 (local e2e fails), PAR-9 (NUL in replies), PAR-10 (related-agreements card). Next: wave B (T22, T23, T24, T25, T27, T28).

### 2026-09-25T13:03:18Z
Owner approved T21's two spec changes: no tanstackStartCookies(); autoSignInAfterVerification false (confirming the email does not sign in on that device).

### 2026-09-25T13:48:44Z
Wave B1 paused (usage limit). Worktrees kept, base a18bfcf: .claude/worktrees/wf_a38fbbde-1d7-1=T22, -2=T23, -3=T24; uncommitted edits may exist. All three were still in build. Resume: new agents continue each from its worktree (build, review, fix), then merge one by one.

### 2026-09-25T19:12:13Z
Wave B1 merged (4fb2034): T22 history+search, T23 settings+password/email flows, T24 PDF/DOCX export with quota. Migrations: 0002_draft_history_pages (T22), 0003_counted_export (T24, renumbered). ADR-0006. Gate green: check, 1014 unit, 301 worker, db:check; e2e Chromium+Firefox 77/80, the 3 failures pass alone (shared test data, logged on PAR-8). Local dev DB migrated. T27 got Musts: export rate limit, guest captcha. Filed PAR-11 (Turnstile reset), PAR-12 (phone drawer). Neon migrations 0002+0003 not applied yet.

### 2026-09-25T19:16:42Z
Wave B2 (T25, T27, T28) started then stopped at the owner's request before any commit; its empty worktrees removed. Found: CI e2e failed on a18bfcf (wave A): sign-up on the Preview says 'Something went wrong' because Better Auth logs 'Missing secret key' (Turnstile), though TURNSTILE_SECRET_KEY is on the Preview base config. Under investigation.

### 2026-09-25T20:03:43Z
Preview CI fixed: sign-up (Turnstile test secret now in previews.vars; base-config secrets reach only new Previews) and first-load layout shift (Linux fallback fonts: Tinos/Liberation and Noto faces, Capsize-checked; CLS 0.050 -> 0.015). Owner chose font-display swap over optional: the zero-shift e2e now allows <= 0.02.

### 2026-09-25T20:11:12Z
Session end. Finished: waves A (T21, T29, T30) and B1 (T22, T23, T24) built, reviewed, fixed and merged; Neon preview migrated (0002, 0003); T21 production secrets set; Preview CI fixed (Turnstile test secret in previews.vars; Linux font fallbacks, CLS 0.05 -> 0.015, owner kept font-display swap, e2e budget 0.02). CI green on 576e1cb. 27 of 42 tasks done. Next session: wave B2 (T25, T27, T28) with work/PAR-1/waves/wave-b2.js (faster rules in plan.md; update SCRATCH and BASE), then wave C (T23b, T26, T31, T37), then STOP at Checkpoint 6. Open: PAR-8..12; production migrations 0002/0003 wait for T38 with owner OK; owner checks: one exported PDF, one DOCX in Word, Observability chat_turn on the Preview.
