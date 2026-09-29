# The bar

Each project proves I can build at the level of the best (Apple, Google, top engineers).
Websites should look stunning, go full creative mode, make it tasteful.

# Testing

Test what can hurt, for real. Every outside service (payments, email, auth, AI) must
work in its real sandbox, not only with mocks, before the feature is done.

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
- Vitest · Playwright · agent-browser · Claude in Chrome · Chrome DevTools (MCP) · React DevTools · TanStack Devtools (Router, Query, Form)
- Cloudflare Containers (Bun 1.4+) for what cannot run on Workers: CPU-bound, memory-bound, long-lived
- `wi` (work tracker): Rust CLI, source in `~/Projects/wi`

How to use each tool: `~/Projects/guides/`. Read the guides for the tools a project uses
before writing its spec and plan, so their rules shape the tasks from day one.

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

- I have ADHD and English is not my first language.
- Load `agent-skills:documentation-and-adrs` before writing docs.
- Load `agent-skills:observability-and-instrumentation` before adding logs, traces, metrics or alerts.

# Git

Load `agent-skills:git-workflow-and-versioning` before any branch, commit or merge. On top of it:

- `gh` and `git`.
- Commits carry the work item ID: `<type>(<ID>): <why>`.
- Load `agent-skills:ci-cd-and-automation` before touching CI.

# Session workflow

- Start with `wi show <ID>` (`wi --help`); if I did not name one, ask.
- Follow the agent-skills lifecycle (`using-agent-skills`), sized to the work. Advance a phase when its artifact is approved.
- Size the process to the task: "Not every task needs every skill" (`using-agent-skills`). Say which phases were skipped and why.
- Artifacts go in `work/<ID>/` and are committed as they happen, never left in conversation.
- Session end: `wi log <ID>` with what finished and what is next. New work found on the way: `wi new --origin <ID>`.
