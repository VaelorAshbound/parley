# T40 ship decision: Parley v1.0.0

Checked 2026-10-01 on production 494e33f (parley.runtimedrift.dev). Three reviewers ran in parallel, read-only: code-reviewer, security-auditor and test-engineer. The lead checked infrastructure, performance and documentation directly.

## Ship Decision: GO, after two small cost fixes

No reviewer found a Critical issue, and none found a High one. Two findings break a promise that ADR-0012 makes ("the AI spend can't be run up"), and each one takes about one line to fix. Fix them, then tag v1.0.0.

### Fix before the tag (both confirmed in the code by the lead)

1. **No cap on the model's output.** Security, Medium. `apps/web/src/server/ai/chat.ts:329`: `streamText` has no `maxOutputTokens`. A turn can make up to 8 model calls, and each one can write as much as the model allows. A prompt-injected guest could use up the $10 key cap, and the chat would then stop for everyone.
   - **Fix:** `maxOutputTokens: 4096` per call.
   - **Why that number:** the largest average output in the evals is 876 tokens per call (evals/report.md), so 4,096 leaves room for big questionnaires. Worst case per message drops from about $0.50 to about $0.016.
2. **One message can be 16,000 characters, not 4,000.** Code review, Important. `chat.ts:76-87`: the 4,000-character limit is checked on each part, and a message may have up to 4 parts. The browser only ever sends one.
   - **Fix:** allow 1 part (`.max(1)`), with an API test.

### Recommended (file as wi items, not blocking)

- **Code review:**
  - `pnpm dev` misses a Wrangler login stored in `~/.wrangler` or on macOS (`vite.config.ts`). Use `wrangler whoami`.
  - `scripts/dev.ts`: the app keeps running if Postgres dies after starting; matching "is ready" fails when the text is split across two output chunks; Ctrl+C during startup ends with an unhandled error.
  - The export count and the file can name different agreements if the agreement changes during the ~4 s print (`rpc/export.ts:372-390`).
  - A message id that already exists in another draft is dropped without a word (`queries/messages.ts:78-87`). Only crafted ids trigger it.
- **Test gaps (test-engineer):**
  1. A guest whose GitHub sign-in links to an existing confirmed account.
  2. A signed Polar webhook with another event type, or an unparsable body, gets 200.
  3. A Pro user gets 500 messages a day on a live session.
  4. OpenRouter fails mid-turn: what is saved, and is the day's message used up?
  5. The 2FA code step is rate limited.
  6. Pro callers in the auth matrix.
  - Also nice to have: the production smoke checks `scriptedAi: false`; a double guest link; tests for `scripts/dev.ts`; CI that starts a fresh clone with no keys; CSP e2e on the share and settings pages; two `chat.send` calls at once.
- **Security:**
  - Sign-up says when an email already has an account (Better Auth answers with "already exists" unless `requireEmailVerification` is on). Turnstile slows this down. Record it as a known trade-off.
  - Dev and CI dependencies have CVEs (undici through miniflare, @lhci/cli's dependencies, esbuild through drizzle-kit). None of them are in the Worker bundle. Fix with pnpm overrides.
  - Optional: turn off Better Auth's `/list-sessions`, and put Access in front of old versions' workers.dev URLs.
- **Infrastructure:** the Neon `production` branch is not protected. Protect it.

### Acknowledged risks (shipping anyway)

- **Tracked bugs:** PAR-48 (the document panel moves up while the AI fills fields), PAR-8 (flaky e2e), PAR-5 (old drafts after a definition changes).
- **Open hardening items:** PAR-13 (share view rate limit) and PAR-14 (purge old verification and rate-limit rows).
- **No symptom alerts** (owner decision, T38). The OpenRouter key cap is the cost guard, and Workers Observability keeps the logs.
- **Billing is the Polar sandbox only.** No real money moves.
- **Neon restore window is 1 day** (`history_retention_seconds: 86400`).

## Checked directly (lead)

| Area | Result |
| --- | --- |
| Tests | `pnpm test` 1306 passed, 1 skipped. `pnpm test:workers` 448 passed. CI green on PR #3. Smoke green on 494e33f. |
| Lint, types | `pnpm check` clean. No TODO, FIXME or `console.log` in production code. |
| Performance | Lighthouse on production (phone, 4G, median of 3) on `/`, `/pricing` and `/sign-in`: performance 98, LCP 1.7–1.8 s, CLS ≤ 0.009. Spec budget: LCP under 2.0 s, CLS under 0.05, 95+. |
| Accessibility | Lighthouse 100 on all 3 pages, plus the axe e2e suite (`a11y.spec.ts`) in CI. |
| Security headers | Live: CSP with nonce and `strict-dynamic`, HSTS, `frame-ancestors 'none'`, nosniff. |
| Secrets | All 10 required production secrets are set (`wrangler secret list`). |
| Migrations | Production has 5 of 5. |
| Health, logs | `/api/health` returns 200. Logs are flowing. The current production version logged no errors in 24 h; the 12 error lines came from Preview test runs. |
| Dependencies | `pnpm audit --prod`: 1 moderate (esbuild through drizzle-kit, not in the bundle). |
| Docs | README, ADRs 0001–0012, and CHANGELOG.md for 1.0.0. |

## Rollback plan

- **Roll back when:**
  - the smoke test or `/api/health` fails after a deploy;
  - 5xx responses rise above about 1% of requests in Workers Observability;
  - chat stops completing (`ai_turn` lines stop, or `api_error` lines spike);
  - a data-integrity or security problem turns up.
- **How:**
  1. `pnpm exec wrangler rollback 3b6489f7-35d2-4883-b0bf-11faa4c6b427` (043768e, the version before T39) from `apps/web`. Or pick a version in the dashboard's Deployments tab. A rollback replaces the code only; secrets and bindings stay.
  2. Check `/api/version` (it shows the commit), `/api/health`, and one guest chat turn.
  3. Then `git revert` the merge on `main`, so the next Workers Build doesn't bring the bad code back.
- **Database:** all migrations so far only add things, so older code runs on the newer schema. For bad data, restore the `production` branch with Neon's instant restore to a point inside the 1-day window.
- **Target time:** under 5 minutes for code, under 15 minutes for a database restore.

## Specialist reports

The full reports are in this session's transcript. Their findings are summarized above, with file and line.

- **Code review:** APPROVE. 0 Critical, 2 Important, 6 suggestions.
- **Security:** GO. 0 Critical, 0 High, 1 Medium, 2 Low, 3 Info.
- **Tests:** 0 Critical gaps, 6 Important, 6 nice-to-have.

## After the fixes (2026-10-01)

- PR #4 merged: production serves 42f5a7b, smoke green, `/api/health` 200, `scriptedAi: false`.
- A real OpenRouter call accepts `maxOutputTokens` and stops at it (`finish: length`).
- `pnpm evals` with the cap: 36/36, right agreement 100%, right field values 100%, 0 invalid writes, every draft finished, $0.0033 per NDA. No reply cut off. "Named a related agreement" went from 80% to 60% (no bar; it varies between runs).
- Follow-ups filed: PAR-49 (test gaps), PAR-50 (dev script), PAR-51 (export attribution), PAR-52 (message id), PAR-53 (security follow-ups).
