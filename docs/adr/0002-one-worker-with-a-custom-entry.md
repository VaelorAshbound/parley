# ADR-0002: One Worker with a custom entry that sends `/api/*` to Hono

## Status

Accepted (spec approved by the owner, 2026-09-23; built in T1)

## Context

Parley has three kinds of server work:

- the pages, rendered by TanStack Start (SSR);
- the API: Better Auth, the oRPC procedures (drafts, the chat stream, export, share) and the Polar webhooks;
- a daily cron job that deletes old guest data (T28).

Cloudflare's TanStack Start guide runs Start as the Worker's `fetch`. A `scheduled()` handler needs a custom `main` entry, which the guide supports. The API could live in Start's own server routes, or in a separate Hono app.

We want one middleware stack for everything under `/api`: request ids, secure headers, logging, rate limits and error mapping. We also want the fewest moving parts: one deploy, one set of bindings, one Preview per branch.

## Decision

One Worker. `apps/web/src/server.ts` is the entry:

- `fetch`: a path of `/api` or `/api/…` goes to the Hono app (`src/server/api.ts`). Every other path goes to the Start handler.
- `scheduled()`: the cron jobs (added in T28).

Hono mounts Better Auth at `/api/auth/*` and oRPC at `/api/rpc/*`. SSR loaders don't call `/api` over HTTP. They call the oRPC router in the same process (oRPC's "Optimizing SSR" recipe, T14).

## Alternatives considered

### Start server routes for the API

- Pros: no second framework; the guide's default entry.
- Cons: no single middleware stack for auth, RPC and webhooks; each route would repeat the same wrapping. We still need a custom entry for `scheduled()`.
- Rejected: we would pay for a custom entry anyway and get a weaker API layer.

### Two Workers (app + API) joined by a Service Binding

- Pros: the API deploys and scales on its own.
- Cons: two deploys, two Previews to keep in step, and cross-Worker calls for SSR data. Nothing in Parley needs separate scaling.
- Rejected: more cost and more parts for no user-visible gain.

## Consequences

- The routing in `src/server.ts` is ours, not a documented recipe. It is 5 lines, and it is checked with `curl` and the e2e smoke test (`/api/health`, and `/` through SSR).
- The workerd tests import the Hono app, not `src/server.ts`, because the Start server entry is a virtual module that only the Start Vite plugin resolves.
- Any `/api` path that Hono doesn't know returns Hono's 404, never an SSR page.
