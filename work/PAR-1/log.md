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
