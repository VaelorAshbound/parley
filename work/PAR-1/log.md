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
