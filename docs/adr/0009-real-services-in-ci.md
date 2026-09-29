# ADR-0009: Real services in CI: a Neon branch per Preview, real tests in GitHub Actions

## Status

Proposed (T33, 2026-09-29). Needs the owner's secrets and settings to take effect (work/PAR-1/todo.md, T33).

## Context

Spec §6 asks for real services, not only mocks: on every PR a real-model NDA to PDF, a Polar sandbox checkout, a Resend email and Turnstile, "on a preview + Neon branch"; each night all 12 documents, the evals, mutation and load tests and the real Turnstile keys; after a deploy, a smoke test on the live site.

Until now every Worker Preview shared one Neon branch (`preview`, ADR-0004). So a task's new migration broke every other Preview, and CI could not confirm an email or read a reset token without touching shared data, which kept the share and email e2e tests local only (T32).

ADR-0001 put only the browser tests in GitHub Actions and kept Cloudflare secrets out of GitHub.

## Decision

**A Neon branch per git branch, made in the Workers Builds Preview command** (`scripts/ci-preview.sh` → `packages/db/scripts/preview-database.ts`), the pattern of Neon's own Cloudflare example:

- `preview/<slug>` is created from `production` with a 14-day expiry, or reset from it on every build, so each run starts fresh from production's schema, then gets this branch's migrations.
- A Hyperdrive config `parley-preview--<slug>` (caching off) points at it, and the built Worker's `previews.hyperdrive` is bound to it before `wrangler preview`. Per-branch configs whose Neon branch has expired are removed on the next build.
- Without `NEON_API_KEY` in the build, the Preview keeps the shared database, as before.

**The real tests run in GitHub Actions** against that Preview, like the e2e tests (ADR-0001: Workers Builds has no browsers):

- `real.yml` on every PR: `pnpm test:real` (`apps/web/playwright.real.config.ts`).
- `nightly.yml`: evals, the 12-document export, `test:workers:real`, performance, production checks, then a report emailed with the run's link.
- `smoke.yml` after each production deploy.
- The e2e job and the real job look up the Preview's branch URL with `NEON_API_KEY` and confirm emails there.

This changes ADR-0001 in one place: the nightly export needs `CLOUDFLARE_API_TOKEN` in GitHub for Browser Run (wrangler's remote bindings). It should be a token with Browser Run only.

## Alternatives Considered

### Create the Neon branch in GitHub Actions

- Pros: every secret in one CI.
- Cons: the Preview is built in Workers Builds at the same time; it would have to wait for GitHub, or bind a branch that doesn't exist yet.
- Rejected: the Preview command is the one place that runs before the Preview exists.

### A DATABASE_URL secret per Preview, no Hyperdrive

- Pros: no Hyperdrive permission on the build token, no configs to clean up.
- Cons: Previews would talk to Neon differently from production (spec §5: pg through Hyperdrive).
- Rejected: the point is to test what production runs.

### A test-only "confirm this email" route on Previews

- Pros: no Neon key in GitHub.
- Cons: a back door in the shipped Worker, one config slip from production.
- Rejected: security over convenience.

### Run the real tests in Workers Builds

- Pros: its secrets are already there.
- Cons: no browsers (ADR-0001), and it would run on production deploys too.
- Rejected.

## Consequences

- Each PR's migrations run for real on Neon before merge; a Preview never breaks another.
- The owner sets: Workers Builds variables `NEON_API_KEY`, `NEON_PROJECT_ID`, and Hyperdrive: Edit on the build token; GitHub secrets `NEON_API_KEY`, `RESEND_API_KEY`, `OPENROUTER_API_KEY_TEST`, `CLOUDFLARE_API_TOKEN`; variables `NEON_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `REPORT_EMAIL`, `PERF_URL`, later `NIGHTLY_URL` and `PRODUCTION_URL`. Until then each part skips instead of failing.
- A Preview branch copies production's data. Before launch that is only test data; after launch (T38) Previews should branch from an anonymized or schema-only parent.
- Every Preview build resets its branch: data made by hand on a Preview is gone on the next push.
- Polar's sandbox webhook points at one Preview (PR #1's). A Polar test on another PR can pay, but Pro turns on only where the webhook goes.
- Cost per PR: one real NDA (about $0.002 on the test key), one Resend email, one Browser Run print.
