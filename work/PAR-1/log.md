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

### 2026-09-26T02:51:04Z
Wave B2 merged and pushed (T25 share links e.g. 94dbfb1, T28 purge 6a1bb45, T27 limits + PAR-11 e0012e3), CI green on 5d273a6 (Workers Builds + e2e). Gate: check, 1101 unit, 370 worker, db:check. Local e2e: the 2 remaining failures fail at the same rate on the pre-wave commit (PAR-8). Owner decisions: keep the Share menu; Previews use the capped test OpenRouter key (base config set; the existing PAR-1-parley Preview may still hold the old key, not checked yet). Filed PAR-13..16. No new migrations. Owner asked to hold wave C. Wave C script must reset worktrees to BASE (harness made them from main).

### 2026-09-26T04:20:39Z
Wave C paused at the owner's request (RAM: another project's session needs the memory). Stopped during build. Worktrees kept, base 5d273a6: .claude/worktrees/wf_af3c2e47-d76-1=T23b (2 commits, uncommitted edits), -2=T26 (1 commit + edits), -3=T31 (edits only), -4=T37 (3 commits). Resume: new agents continue each task from its worktree (build, review, fix), then merge one by one. Script: work/PAR-1/waves/wave-c.js.

### 2026-09-26T18:17:26Z
Session end. Finished: wave B2 (T25, T27, T28) built, reviewed, fixed, merged; CI green on 5d273a6. Previews use the capped test OpenRouter key; Share menu kept (owner). Filed PAR-13..16; PAR-8 notes (cold dev server fails ~half locally, same before B2). 28 of 42 tasks done. Wave C started, then paused for RAM (owner). Next session: resume wave C from its 4 worktrees (wf_af3c2e47-d76-1..4, base 5d273a6), re-checking half-written edits; then merge, gate, push, CI, STOP at Checkpoint 6. Open: check which OpenRouter key the existing PAR-1-parley Preview uses; owner checks (one PDF, one DOCX in Word, chat_turn log).

### 2026-09-27T16:19:53Z
Owner decision: wave C goes one task at a time, not in parallel, starting in a fresh session. Each task continues from its saved worktree (wf_af3c2e47-d76-1=T23b, -2=T26, -3=T31, -4=T37; base 5d273a6): check half-written edits, build, test, review, simplify, merge, gate, push, CI. Then STOP at Checkpoint 6.

### 2026-09-27T17:55:47Z
T37 merged (68786f9) and pushed; CI green on 5ec4890 (Workers Builds + e2e). Review fixed: headline jumped a line at 1440 px (italic face now preloaded on / only), failed start/Turnstile shown by the box and in view, phone bar a labeled group, dark-mode composer shadow, reduced-motion highlight fade, 44 px chips on phones; new e2e for each. Gate: check, 1111 unit, 370 worker, db:check, e2e 104/105 (Firefox limits.spec goto abort, same on pre-T37 b7def71, logged on PAR-8). Process change from another session: test/review/simplify per checkpoint, not per task. Next: T23b from worktree wf_af3c2e47-d76-1, then T26, T31, then Checkpoint 6.

### 2026-09-27T17:57:47Z
Session end. Finished: T37 (empty-state and first-run polish) built, reviewed, fixed, merged (68786f9), pushed; CI green on 5ec4890. 29 of 42 tasks done. Next session: T23b from worktree wf_af3c2e47-d76-1 (base 5d273a6; 2 commits + uncommitted edits: check them first), then T26 (-2), T31 (-3), one at a time, then Checkpoint 6 with /test, /review, /code-simplify per checkpoint (new rule). Local e2e needs 'pnpm db:dev' running. Open: check which OpenRouter key the PAR-1-parley Preview uses; owner checks (one PDF, one DOCX in Word, chat_turn log).

### 2026-09-27T18:20:02Z
T23b merged (ffdb8d1) and pushed; CI green on ffdb8d1 (Workers Builds + e2e). Continued from worktree wf_af3c2e47-d76-1: server + code step were committed; the Settings card + e2e were staged and complete. Fixed on the way: a type error (enable can reply method otp), 2 a11y lint notes, account.get test missing the twoFactor field. Gate: check, 1124 unit, 388 worker, db:check, e2e two-factor Chromium + Firefox 4/4. Screens checked at 1440 light/dark and 375. Next: T26 from worktree wf_af3c2e47-d76-2 (1 commit + edits: check them first), then T31 (-3), then Checkpoint 6.

### 2026-09-27T20:13:14Z
T26 merged and pushed (last 417b24b). Real sandbox run on the Preview passed: test-card checkout -> webhook -> pro -> cancel at period end -> still pro -> revoke -> free. Built: plan on user row (migration 0004, applied to Neon preview), /pricing, account menu plan badge + Billing/Upgrade, Pro gets Word/unlimited/AI budget, ADR-0008. Fixed on the way: 15 adversarial-review findings (delete always cancels billing, current state per webhook, per-user BILLING_RATE_LIMITER, portal POST-only, no discount codes); Polar whsec_ secrets (made since 2026-09-08) can't be checked by the plugin's 0.x SDK, so Parley has its own webhook route (standardwebhooks, both keys); checkout now pre-fills the confirmed email. Preview: Polar secrets in base config; PAR-1-parley Preview deleted+recreated (owner OK); sandbox webhook points at it and was re-enabled after Polar disabled it. Gate: check, 1145 unit, 435 worker, db:check. CI: 1dd6594 e2e failed on search-dialog.browser.test 'arrow keys' (not T26 code; passed the run before), 417b24b running. Filed PAR-17. Next: check CI on 417b24b, then T31, then Checkpoint 6. Production (T38) needs its own Polar endpoint + secrets + migration 0004 with owner OK.

### 2026-09-27T20:21:01Z
Session end. Finished: T23b (two-factor) and T26 (Parley Pro via Polar sandbox, real run passed) merged; CI green on 417b24b. 33 of 42 tasks done. Local commit 3e6e52f (PAR-8 flaky-test notes) not pushed yet: goes with the next push. Next session: T31 from worktree wf_af3c2e47-d76-3 (base 5d273a6, edits only: check them first, rebase on PAR-1-parley), then Checkpoint 6 with /test, /review, /code-simplify. Worktrees -1 (T23b) and -2 (T26) are merged and can be removed. Open: T38 production needs Polar endpoint + secrets + migration 0004 (owner OK); PAR-17; owner checks (one PDF, one DOCX in Word, chat_turn log).

### 2026-09-28T16:38:56Z
T31 done (merge c55fa5d, docs e3884c4), pushed; CI green on e3884c4 (Workers Builds + e2e; e2e re-run once because the build sat 9 min in Cloudflare's queue behind priced). pnpm test:real: all 12 documents (11 files) printed by real Browser Run + Word, read back word for word, 119 PDF pages pixel-equal to approved baselines (0 pixels allowed; a second real print matched). Real print bugs fixed with tests: variable fonts embedded as Type 3 (now static TrueType, 13% smaller), lone license line on a page, heading-only clauses and part headings alone at a page foot, orphans/widows 3 dropped by Chrome (now 2), Word footer page numbers too big in LibreOffice. Worktrees -1..-3 removed. 34 of 42 tasks done. STOP at Checkpoint 6 (owner review): look at a few exported PDFs; eval report is evals/report.md. Next: T32 alone, then wave T33+T34+T35, then T36. test:real is not in CI yet (T33 nightly).

### 2026-09-28T16:42:30Z
Checkpoint 6 approved by the owner.

### 2026-09-28T18:06:20Z
Checkpoint 6 quality pass done (review, simplify, test); CI green on 299bf8e. Review (3 reviewers, each finding verified) fixed with tests: OAuth auto-link skipped 2FA (ec49e5d); a Preview could cancel production Pro, now checkout stamps metadata.stage (b26d4a9, ADR-0008); cancel Polar again after delete (52bfd8b); backup codes survive Escape/outside click (cc27dbd); start page jumped 175 px on a phone first visit (499269c); failed start keeps typed text (0de103a); real export checks terms in order, numbered (ffed319); font-synthesis none (ab16731). 5 simplify refactors. Local gate: check, 1155 unit, 438 worker, 44 real, full e2e. Local .dev.vars lacked POLAR_ACCESS_TOKEN (delete-account e2e failed locally since T26); copied from .env. Filed PAR-18 (high, before T38) .. PAR-23. Next: T32 via /build.

### 2026-09-28T18:09:15Z
Session end. Finished: T31 (real export of all 12 documents, 5 print bugs fixed), Checkpoint 6 approved by owner, Checkpoint 6 quality pass (8 review fixes incl. 2FA OAuth-link bypass and cross-stage Polar cancel, 5 refactors, PAR-8 Ctrl+K race fixed). CI green on 299bf8e. 34 of 42 tasks done. Next session: T32 alone via /build (full e2e x 3 browsers x desktop/phone + a11y; fold in PAR-8), then wave T33+T34+T35, then T36, Checkpoint 7, then T38 (PAR-18 first) -> T39 -> T40. Local e2e needs 'pnpm db:dev'; apps/web/.dev.vars now has POLAR_ACCESS_TOKEN (sandbox).

### 2026-09-28T21:11:26Z
T32 done (6dfeb8a..1274e8d), pushed. Scripted AI for e2e (cookie, off in production), chat/a11y/keyboard/phone/visual specs, 6 browser projects in Playwright's image on PRs, pnpm test:e2e:docker. Real bugs fixed: pick reason not shown, chat box faded when empty, unpicked option contrast, no skip link, text typed before hydration lost, nested main. PAR-8: search race and navigation-abort flakes fixed. CI on 1274e8d: 7/8 green, desktop WebKit still running at close (not waited on). New owner rule in plan.md: check locally, push once per task, batch CI fixes, CI at checkpoints. Next: wave T33+T34+T35 (T33 also runs confirmed-email e2e on Previews), then T36, Checkpoint 7.

### 2026-09-29T15:25:45Z
Process session (no code). Audit vs agent-skills: 23 contradictions (report in chat; causes traced to CLAUDE.md, intent, plan). CLAUDE.md rewritten by owner and made identical in ~/Projects, parley and priced: dropped one-branch-per-item, one-item-per-session, Workers Preview/Builds lines; added Testing rule (outside services must work in their real sandbox), hands-on test tools, pointer to ~/Projects/guides. New ~/Projects/guides/: 12 cleaned tool guides from the Vault, read before spec and plan. Local commits not pushed (7a4a138..8ed414a); priced/CLAUDE.md changed but not committed. Next: decide on the audit items (red WebKit CI, never-merged branch, e2e scope), then T33+T34+T35.

### 2026-09-29T15:37:47Z
Next session: wave T33+T34+T35 in parallel worktrees (owner OK: Priced won't run at the same time). Check each task locally, merge, then one push for the whole wave; check CI at the start (last push 56f2347 adds --ipc=host for the WebKit crash). Then T36, Checkpoint 7, PAR-18, T38-T40. PR #1 stays open until launch; e2e moves to nightly after the build (PAR-24).

### 2026-09-29T20:35:10Z
Wave D2 merged (T33 c1d6083, T34 70dae18, T35 merge), pushed. T35 done (owner accepted real first token 4.0 s and sign-in LCP; pg_stat_statements on preview+production, outliers clean). T34 closed by owner (coverage gates on; mutation 89.2% documents/quota, 96.2% auth; survivors left; PAR-25, PAR-26). T33 built: owner set GitHub secrets/vars, Workers Builds Neon vars, Browser Run token, Preview RESEND_API_KEY; nightly also runs on the PR label 'nightly' (GitHub runs schedule/dispatch only from main). Fixed today: form text typed before hydration (13281e9), Undo while the picked agreement loads (cb653e6), search test race (f0d2aea), UI coverage typecheck in CI (390ac8a). WebKit CI still flaky (PAR-8). Next: real email on the Preview, first Nightly run green with costs -> T33 done; then T36, Checkpoint 7.

### 2026-09-29T21:21:21Z
Session end. Real services green on 73bf59a (real model NDA->PDF, Polar sandbox with a new payer email per run, Resend email, Turnstile, smoke). T33 setup done: GitHub secrets/vars, Preview build NEON_API_KEY/NEON_PROJECT_ID (via cf CLI), Browser Run token, Preview RESEND_API_KEY; old parley-ci Neon key revoked. CI sped up (67e38de): Previews build without the test gate (main keeps it), push e2e Chromium only (6 browsers nightly), Real services on PR label 'real'. Open: re-run Nightly export + performance (export failed on the empty token, now set; perf was noise on a busy Preview), then mark T33 done with costs. Owner to delete 2 unused Cloudflare tokens (older 'parley-nightly-browser-run', 'browser-run'). Next session: quick batch PAR-9, PAR-12, PAR-11, PAR-22, PAR-16; then PAR-18 (before T38); then T36.

### 2026-09-29T21:47:51Z
Session: PAR-9, 11, 12, 22, 28 done and merged; PAR-16 merged, in verify (Preview check left). Filed PAR-29, PAR-30. Next: quick ones PAR-13, PAR-14, PAR-29; PAR-18 before T38.

### 2026-09-29T22:37:14Z
Session end. Finished: checked CI after the Stryker removal (install fixed at 1edebf1). UI coverage gate removed (owner; c77bbae): test:coverage:ui, UI thresholds, spec §6 row; component job still runs Chromium + Firefox. documents/db/server gates stay. CI green on c77bbae (Workers Builds, component 2m10s, e2e 7m04s). Checkpoints 3-5 ticked with evidence (b685e3a, local: owner pushes it with the next change). No wi items were done-but-open; the wave (PAR-9, 11, 12, 16, 22, 28) is closed. Flaky first-run:70 noted on PAR-8. Slowest e2e: two-factor.spec:107 at 45.7 s. Next: T36 (QA pass), Checkpoint 7, PAR-18, then T38-T40.

### 2026-09-30T14:54:56Z
Next session plan (owner, 2026-09-30): T36 QA pass, folding in PAR-29 (one-line drawer fix) and PAR-6 (sideways scroll + e2e) first, then the QA run; check PAR-30 and PAR-7 when QA reaches the chat. Touch PAR-20/21 screens in QA (already planned). Later: PAR-18 before T38; PAR-13/14/31/5/8 separate. 2 local commits (b685e3a + session log) go out with T36's first push.

### 2026-09-30T16:00:55Z
T36 done as a workflow wave: PAR-29 and PAR-6 fixed in worktrees and merged (e321a6f, a5b3fe7); 3 QA agents on the Preview; report work/PAR-1/qa.md. Filed PAR-32 (high: live document misses the first change, blocks Checkpoint 7), PAR-33..35 medium, PAR-36..44 low, PAR-45 design notes. No memory leak over 100 messages. Owner: a short Claude in Chrome look (agents could not), and check Polar sandbox cancelled the deleted QA Pro account's subscription. Next: PAR-32, then Checkpoint 7, then PAR-18 before T38.

### 2026-09-30T16:08:25Z
Owner: the Claude in Chrome gap in T36 is accepted. Polar sandbox checked by the owner: the deleted QA Pro account's customer is anonymized and its subscription is no longer active (only the owner's own 'testing' subscription is active). Nothing left from T36 for the owner. Next: PAR-32, then Checkpoint 7.

### 2026-09-30T18:08:51Z
QA-fixes wave merged (4 lanes): PAR-30, 32, 33, 34, 35, 36, 37, 38, 39, 41 done; PAR-40, 42 get the owner's choices next. Fixed after merge: an old Worker test broken by PAR-9, and a timing bug in the PAR-33 test. Gate after merge (e87c0ca): pnpm check pass; pnpm test 105/105 files x3; test:workers 448 passed; e2e chromium+firefox+both phone projects 280 passed, 22 skipped, 0 failed. Filed PAR-46 (Enter while busy), PAR-47 (mark stopped replies). Owner decisions logged on PAR-33..45. Next: follow-up wave PAR-40+42, PAR-44, PAR-45; then Checkpoint 7.

### 2026-09-30T20:31:07Z
Follow-up wave merged: PAR-40, 42, 44, 45 done (owner OK on all calls). After merge fixed: CI component job (Vite dep scan stopped at cloudflare:workers, stub alias), stale visual baselines, auth card region name clashing with field labels, a Firefox sign-out race in account.spec. Gate after merge (9cf8efc): pnpm check pass; pnpm test 107/107 files; test:workers 448 passed; e2e chromium+firefox+both phone projects 290 passed, 22 skipped, 0 failed; visual baselines in Playwright's image 20/20. CI was red on 266aef1 and fe93597 (component reloads + draft visual baselines); both causes fixed in this push. Next: check CI, then Checkpoint 7, then PAR-18 before T38.

### 2026-09-30T20:51:48Z
Checkpoint 7 passed (owner, 2026-09-30): CI green on 7fff76a; local gates green; no open high-severity bugs. Nightly skipped by the owner; it runs at the next checkpoint. Next: PAR-18 (Polar daily reconcile) before T38, then T38 -> T39 -> T40.

### 2026-09-30T20:53:08Z
Session end (2026-09-30). Finished: T36 (QA pass, qa.md) and three workflow waves: PAR-29, PAR-6; PAR-30, 32..39, 41; PAR-40, 42, 44, 45 (owner OK on every design call). Checkpoint 7 passed (nightly skipped by the owner, runs at the next checkpoint). CI green on 7fff76a. Fixed on the way: CI component reloads (cloudflare:workers stub), an old Worker test broken by PAR-9, visual baselines that depended on OAuth in .dev.vars. Filed PAR-46, PAR-47. 39 of 42 tasks done; 13 wi items open. Next session: PAR-18 (Polar daily reconcile + alert) before T38, then T38 (fold in PAR-43) -> T39 -> T40; run the nightly at the next checkpoint. Local db:dev runs detached (setsid); stop it with pkill -f scripts/dev.ts when done.

### 2026-09-30T21:00:33Z
PAR-18 cancelled (owner): sandbox-only billing, no real money, so the reconcile protects nothing. T38 no longer waits on it.

### 2026-09-30T21:11:24Z
T38 scope (owner, 2026-09-30): core (domain, production config, Polar sandbox webhook, security headers, smoke) + anonymized Preview parent + version URLs off. Symptom alerts (5xx, ttft, cost) skipped: portfolio traffic, OpenRouter key cap is the cost guard.

### 2026-09-30T21:15:14Z
T38 deploy path (owner, 2026-09-30): merge PR #1 into main at the end of T38 (after headers, Polar production webhook + secrets, and production migrations 0001-0004 with owner OK), so Workers Builds deploys with the full gate and smoke.yml checks the live domain. T39/T40 then land on main.

### 2026-09-30T22:02:20Z
T38 step 5: production migrations 0002-0004 applied (owner OK); 5 rows in __drizzle_migrations, plan columns and counted_export present.

### 2026-09-30T22:04:11Z
T38 step 6: Polar sandbox webhook for parley.runtimedrift.dev (c9ebdb66); production secrets POLAR_WEBHOOK_SECRET, POLAR_ACCESS_TOKEN, and a new sending-only Resend key (parley-production-sending, mail.runtimedrift.dev) as RESEND_API_KEY. Old full-access Resend key left for the owner to delete. Step 7: custom domain route in wrangler.jsonc, live on the merge deploy.

### 2026-09-30T22:31:30Z
Session end (2026-09-30, paused by owner before the merge). Done: PAR-18 cancelled (sandbox billing); T38 steps 1 security headers (d9f26db, 15e42ad), 2 PAR-43 (ea0bd5e), 3 not possible (preview_urls also drives CI Previews), 4 skipped (owner), 5 production migrations 0002-0004 applied, 6 Polar production webhook c9ebdb66 + POLAR_* secrets + sending-only Resend key, 7 custom domain route (f75b61b, live on deploy). Branch pushed; PRODUCTION_URL set, NIGHTLY_URL removed (nightly stays off until the next checkpoint). OPEN: CI e2e red on f75b61b: security-headers.spec sees 4 'script-src blocked eval' on the Preview build (assets/schemas-*.js): a Zod schema is built before router.tsx's jitless import runs. Fix idea: set globalThis.__zod_globalConfig = { jitless: true } in a nonce'd inline head script before any module. Local full e2e (dev) was 210 passed / 1 failed (a11y dark @phone draft closed, retry pending) at pause. Next: fix Zod probe, CI green, then step 8 merge PR #1 (owner already OK'd) and step 9 live checks. Owner: delete the old full-access Resend key after launch.

### 2026-10-01T18:07:24Z
T38 done (2026-10-01): parley.runtimedrift.dev live on 043768e, smoke green, A+ headers, forged Turnstile 403, owner chat turns OK. Fixed: Zod probe (8818e02), date-dependent visual baselines, production gate (documents coverage, Worker test timeout), deploy command now ci-deploy.sh, smoke chat turn skipped on production. Open: owner Google sign-in on production; delete old full-access Resend key. Next: T39 (README + ADRs), T40 (/ship).

### 2026-10-01T18:09:39Z
Google sign-in on production checked (owner; 1 google account). Resend: deleted the unused old production key (parley-production-sending, 2026-09-25); kept 'email' (full access, used locally), parley-ci, priced-ci, and the new production key. T38 has nothing open.

### 2026-10-01T18:10:17Z
Session end (2026-10-01). Finished: T38, Parley live on parley.runtimedrift.dev (043768e): smoke green, A+ headers, forged Turnstile 403, owner chat turns + Google and GitHub sign-in OK. Fixed on the way: Zod eval probe vs CSP, date-dependent visual baselines, production gate (documents coverage after PAR-40, Worker test timeout), deploy command now ci-deploy.sh, smoke chat turn skipped on production. Deleted the unused old production Resend key. Flake noted on PAR-8 (a11y phone draft, ~1 in 12). 40 of 42 tasks done. Next session: T39 (README + ADRs; docs skill first), then T40 (/ship). Branch PAR-1-parley is ahead of main by docs commits only; future work goes through PRs to main (production deploys from main). Nightly still off (NIGHTLY_URL unset) until the next checkpoint.

### 2026-10-01T18:37:31Z
T39 in progress: plan (be67060), ADRs 0010-0012 (6858dc1), local setup in 3 commands checked on a fresh clone in a clean podman container with no keys or login (39db62c, 7b417ee). Next: architecture diagram, 30 s GIF from production, README.

### 2026-10-01T19:28:10Z
T39 built, not yet pushed (9 local commits be67060..cf24c17): ADRs 0010-0012; local setup in 3 commands (pnpm dev writes .dev.vars, starts Postgres; scripted AI with no key; no remote bindings without a Cloudflare login) checked on a fresh clone in a clean podman container; architecture diagram light+dark; README with evals, cost, test pyramid (pnpm test 1306 passed/1 skipped, test:workers 448 passed). GIF dropped by the owner (the take showed PAR-48, filed). Next: push + PR to main, check README on GitHub in light and dark, then T39 done -> T40 /ship.

### 2026-10-01T19:36:54Z
T39 done (PR #3, CI green: Workers Builds, component, e2e chromium). README checked on GitHub in light and dark. PR #3 is open, waiting for the owner's OK to merge (merging deploys production). Next: merge PR #3, then T40 (/ship).

### 2026-10-01T19:53:05Z
PR #3 merged (494e33f). Production serves 494e33f, scripted AI off, smoke green. Next: T40 (/ship).
