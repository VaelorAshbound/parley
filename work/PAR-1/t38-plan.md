# T38 plan: production on `parley.runtimedrift.dev`

Owner decisions (2026-09-30): alerts skipped; PR #1 merges into `main` at the
end of T38, so Workers Builds deploys with the full gate and `smoke.yml` checks
the live domain. PAR-18 cancelled (Polar is sandbox only, no real money).

## Where production stands (checked 2026-09-30)

| Thing | State |
|---|---|
| Zone `runtimedrift.dev` | Active, this account, Free plan. Other apps already use it (accord, priced). |
| Worker `parley` | Exists; last version 2026-09-25 (old code from `main`). No custom domain. |
| Production secrets | 8 of 10 set. Missing: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`. |
| Neon `production` branch | 2 of 5 migrations applied (0000, 0001). 0 users. |
| Polar sandbox webhooks | One endpoint, the PAR-1-parley Preview. None for production. |
| Security headers | `secureHeaders()` defaults on `/api`; share pages have their own. SSR pages have none. |

## Tasks

Each task is checked before the next one starts. Production changes (marked
**OK**) wait for the owner's OK at that moment.

1. ✅ (d9f26db, 15e42ad) **Security headers (code).** One policy in `src/server/headers.ts`: CSP
   (self, Turnstile, Polar checkout redirect, fonts; nonce or hash if Start
   needs inline scripts), HSTS, `frame-ancestors 'none'`,
   `Referrer-Policy: strict-origin-when-cross-origin`, nosniff,
   Permissions-Policy. Applied to `/api` (replacing the defaults) and to the
   SSR responses in `src/server.ts`. Share pages keep their stricter
   `no-referrer`.
   Verify: Worker tests on the headers of each response kind; full e2e on
   Chromium + Firefox with the CSP on (no CSP errors in the console).
2. ✅ (ea0bd5e) **PAR-43 (code).** `/pricing` drops `checkout_id` and
   `customer_session_token` from the URL once the banner has read them
   (`history.replaceState`). Verify: e2e.
3. ~~**Version URLs off for production (config).**~~ Not possible (checked
   2026-09-30): `preview_urls` turns on both Version URLs and the per-branch
   workers.dev Preview URLs that CI tests against, with no separate switch
   (wrangler 4.136 schema; developers.cloudflare.com/workers/previews/custom-domains).
   Left on. Sign-in already refuses those hosts in production (`allowedHosts`).
4. ~~**Previews stop copying production data (config).**~~ Skipped (owner,
   2026-09-30): a schema-only branch has no migration rows, so every Preview
   build would re-run all migrations and fail; the copies stay in the owner's
   Neon project, and production has 0 users. Not filed.
5. **Production migrations 0002–0004.** **OK.** Run `pnpm db:migrate`
   against the production branch. Verify: `__drizzle_migrations` has 5 rows,
   `db:check` clean.
6. **Polar production webhook + secrets.** **OK.** New sandbox endpoint
   `https://parley.runtimedrift.dev/api/auth/polar/webhooks`
   (`customer.state_changed`), then `wrangler secret put` for
   `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`. Check `RESEND_API_KEY` in
   production is the sending-only key (T21 note); swap it if not.
7. **Custom domain.** **OK.** `routes: [{ pattern: "parley.runtimedrift.dev",
   custom_domain: true }]` in `wrangler.jsonc`; takes effect on the deploy.
   Set GitHub var `PRODUCTION_URL` (turns on `smoke.yml`) and `NIGHTLY_URL`.
8. **Merge PR #1 into `main`.** **OK.** Workers Builds runs the gate and
   deploys; `smoke.yml` runs on the live domain.
9. **Live checks.** Smoke green; securityheaders.com A or better; a forged
   Turnstile token gets 403 (T21 note); one Pro checkout with the test card
   on production turns Pro on (real sandbox); owner: Google sign-in once.

## Rollback

- Code: `wrangler rollback` to the previous version (under a minute), or
  revert the merge on `main`.
- Migrations 0002–0004 only add columns and tables, and the old code ignores
  them, so a rollback needs no database change.
- Domain: remove the route; the Worker stays.

## Not in T38

- Alerts (owner, 2026-09-30).
- Nightly run: at the next checkpoint (owner, 2026-09-30).
