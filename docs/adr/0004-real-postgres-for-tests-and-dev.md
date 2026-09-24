# ADR-0004: Real Postgres for tests and local dev, from npm (embedded-postgres)

## Status

Accepted (owner, 2026-09-24; built in T13)

## Context

The spec wants SQL tested on real Postgres ("local in dev, a Neon branch in CI") and a local Postgres for dev. But:

- Workers Builds, which runs our CI gate, has no Docker and no root (ADR-0001).
- This machine has no Postgres installed. Podman works here, but not in CI.
- Neon runs Postgres 18. The tests should run on the same major version.
- Production talks to Postgres through `pg` (node-postgres) and Hyperdrive, so the tests should use `pg` too.

## Decision

Use [`embedded-postgres`](https://github.com/leinelissen/embedded-postgres) (dev dependency of `packages/db`). It ships real Postgres binaries as npm packages and runs them as a normal user.

- **Tests** (`db` Vitest project): one Postgres 18 per run, started in `test/setup.ts` on a free port and migrated with the real migrations. Each test runs in a transaction that rolls back (`test/db.ts` fixture), so tests need no cleanup. It starts in about 0.4 s.
- **Local dev** (`pnpm db:dev`): the same server with its data kept in `packages/db/.data/`, on port 54320. Hyperdrive's `localConnectionString` points there.
- **The server runs in a child process** (`test/postgres.ts`). embedded-postgres registers an exit hook (`async-exit-hook`) that calls `process.exit(0)` on `beforeExit`. Inside Vitest's process this erased the failure code: a failing test or a missed coverage threshold still exited 0, so CI would have passed a red run. We found this while building T13 and proved the fix both ways (red run exits 1, green run exits 0).

Cloud side (same task):

- Neon's default branch is `production`. A long-lived `preview` branch serves Worker Previews until T33 gives each PR its own branch.
- Two Hyperdrive configs, both with **caching off** and both on the direct (unpooled) host: `parley` → `production`, `parley-preview` → `preview`. `wrangler.jsonc` binds `HYPERDRIVE` to the first and `previews.hyperdrive` to the second, so previews never touch production data.

## Alternatives Considered

### Podman/Docker container

- Pros: The standard way; any Postgres version.
- Cons: Doesn't run in Workers Builds. CI would skip the DB tests until T33.
- Rejected: DB tests must gate every build.

### PGlite (Postgres compiled to WASM)

- Pros: No binaries, starts fast, runs anywhere.
- Cons: A different driver than production (not `pg` over TCP), one connection only, and its extension and version set differs from Neon's.
- Rejected: We want the production driver and real concurrency for tests like compare-and-set.

### A Neon branch for every test run

- Pros: Exactly production.
- Cons: Network latency on every query, costs compute, and needs secrets in every build.
- Rejected for the unit/integration level. T33 still runs migrations and e2e on a real Neon branch per PR.

## Consequences

- ~60 MB extra dev install. Nothing ships to production.
- The Postgres minor version can differ from Neon's (18.4 vs 18.6). The major version matches, and T33's Neon branch tests cover the rest.
- The version string is always `-beta.N` (the package's own numbering, not a Postgres beta), so it is pinned exactly.
- Its install script only restores symlinks for the shared libraries. It is allowed in `pnpm-workspace.yaml`.
