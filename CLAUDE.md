# The bar

Each project proves I can build at the level of the best (Apple, Google, top engineers).
Three people should say "WOW" with no explanation:

- **User:** looks and feels good. No flash, no jump, fast, clear words.
- **Engineer:** well built. Typed end to end, tested, simple, no leaks, best tool over hand-rolled code.
- **Exec:** cost efficient. Every dollar buys something the user feels. Nothing burns money
  while idle, and it scales without bill shock. Spend well, but don't cut features to save.

# Build like the best

Follow the official guides and known best practices, not the quick way. Learn them first.
Break one only for a real reason, and write the reason down. Don't overengineer.

Build a piece, check it hard, fix what's off, then move on. Done all the way, not just "works".

# Standard tech stack

Default stack for all projects here unless a project says otherwise:

- TypeScript · Vite+ (Rolldown, Vitest, oxlint, oxfmt, tsdown) · pnpm monorepo
- React 19 + React Compiler · TanStack Start/Router/Query/Form/Table · Zustand (client state)
- Tailwind CSS · shadcn/ui · Motion (animation)
- Hono on Cloudflare Workers · oRPC (typed API layer) · Queues · Workflows · Cron Triggers
- Zod (validation) · Temporal (dates/times)
- Vercel AI SDK (LLM orchestration) · OpenRouter (model provider)
- PostgreSQL on Neon (+ pgvector for RAG; local Postgres for dev) · Drizzle ORM · Hyperdrive · KV · R2 · Cloudflare Images
- Better-Auth · Resend (email) · Polar.sh (sandbox version) (payments)
- Cloudflare Rate Limiting · Turnstile · CDN/DNS/WAF
- Vitest · Playwright · Workers Preview (NEW!)
- Cloudflare Containers (Bun 1.4+) for what cannot run on Workers: CPU-bound, memory-bound, long-lived
- `wi` (work tracker): Rust CLI, source in `~/Projects/wi`

# Skill routing

Two meta-skills govern all skill use. Load both at session start and route
every task through them instead of picking skills ad hoc:

- `agent-skills:using-agent-skills` — picks the *process* skill (spec, plan,
  build, test, review, ship).
- `using-stack-skills` — picks the *domain* skill (design, animation, auth,
  AI, Cloudflare, Neon, Resend, Firecrawl, browser).

Loaded skills are binding workflows, not reference material. Before declaring
a task done, re-check the active skill's steps and name which skill you
followed; if you deviated, say where and why. In long sessions, re-read the
skill before each new task — drift is the known failure mode.

# Standards & communication

- I have ADHD and English is not my first language. Speak simple, plain,
  sweet, short English. Always.
- Load `agent-skills:documentation-and-adrs` before writing docs.
- Load `agent-skills:observability-and-instrumentation` before adding logs, traces, metrics or alerts.

# Git

Load `agent-skills:git-workflow-and-versioning` before any branch, commit or merge. On top of it:

- `gh` and `git`. Branches are named `<id>-<slug>`, one per work item.
- Commits carry the work item ID: `<type>(<ID>): <why>`.
- CI is Cloudflare Workers Builds. Load `agent-skills:ci-cd-and-automation` before touching it.

# Session workflow

- A session works one `wi` item (`wi --help`). Start with `wi show <ID>`; if I did not name one, ask.
- Phase = next skill: define -> /spec, plan -> /plan, build -> /build, verify -> /test, review -> /review then /code-simplify, ship -> /ship. Advance the phase when the phase's artifact is approved.
- Artifacts go in `work/<ID>/` and are committed as they happen, never left in conversation.
- Session end: `wi log <ID>` with what finished and what is next. New work found on the way: `wi new --origin <ID>`.
