# Tasks: Parley (PAR-1)

> Plan: [plan.md](plan.md) · Spec: [spec.md](spec.md)
>
> Each task follows TDD: failing test → code → green → `pnpm check && pnpm test` → commit `<type>(PAR-1): <why>`.
> Definition of Done for every task: tests pass, no regressions, behavior checked at runtime, docs updated.
> Size: S = 1–2 files · M = 3–5 files. There are no L/XL tasks.

---

## Phase 0: Prove the risky bits

- [ ] **T1: Monorepo scaffold that runs on Workers** (M)
  - Accept:
    - `shadcn init --template start --monorepo` → `packages/ui`, plus the dark-mode theme provider (`ScriptOnce`, no flash). Check that the shadcn CLI and Vite+ work together (`vp dev`/`vp build`).
    - pnpm workspace with `apps/web`, `packages/documents` and `packages/db`, using Vite+ at a pinned version.
    - TanStack Start + `@cloudflare/vite-plugin`, with a custom `src/server.ts` (`/api/health` served by Hono, everything else by Start).
    - `pnpm dev`, `pnpm check` and `pnpm test` all work, using Vitest `test.projects` in `vite.config.ts`, with 1 sample test and 1 `*.test-d.ts` type test. `apps/web-worker-tests` (Vitest 4.1 + `@cloudflare/vitest-plugin`) runs 1 test in workerd through `pnpm test:workers`.
  - Verify: `pnpm check && pnpm test && pnpm build`. `curl localhost:5173/api/health` returns `{ok:true}`, and `/` renders through SSR.
  - Files: `pnpm-workspace.yaml`, `vite.config.ts`, `apps/web/{vite.config.ts,wrangler.jsonc,src/server.ts,src/routes/index.tsx}`, `package.json`
  - Deps: none

- [ ] **T2: Spike: PDF (Browser Run) and DOCX (`docx`) in workerd** (S)
  - Accept:
    - `/api/spike/pdf` returns a valid PDF made from an HTML string by `env.BROWSER.quickAction("pdf")`.
    - `/api/spike/docx` returns a DOCX from `Packer.toArrayBuffer`. It works in `@cloudflare/vitest-plugin` (Vitest 4.1 package) and when deployed.
    - The results are written to `work/PAR-1/spikes.md`: timings, size, cost per PDF, and go/no-go.
  - Verify: A Worker test parses both files back. A manual download opens in a PDF viewer and in Word/LibreOffice.
  - Files: `apps/web/src/server/spike.ts`, `apps/web/test/spike.test.ts`, `work/PAR-1/spikes.md`
  - Deps: T1 · Owner: Workers Paid

- [ ] **T3: Spike: the full test stack in Workers Builds** (M)
  - Accept:
    - The repo is on GitHub and connected to Workers Builds. The PR build runs `vp check`, the Vitest suites, and 1 Playwright test (Chromium + WebKit + Firefox) against the Workers Preview.
    - Playwright traces and screenshots from failed runs get uploaded to R2, and the build log shows their URLs.
    - A nightly Cron Trigger → Deploy Hook starts a build. Results go into `spikes.md`, with a go/no-go on GitHub Actions.
  - Verify: A PR with a test that fails on purpose shows a red check on GitHub. After the fix, the check is green.
  - Files: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `scripts/ci-*.sh`, `work/PAR-1/spikes.md`
  - Deps: T1 · Owner: GitHub repo + Workers Builds connection

### Checkpoint 0: **stop for owner review**
- [ ] Both spikes are "go", or a fallback was chosen and agreed with you and recorded in an ADR.
- [ ] CI is green on `main` and gives a red check when a test fails.

---

## Phase 1: Brand + document engine

- [ ] **T4: Brand: colors, logo, type, motion feel** (M)
  - Accept:
    - `work/PAR-1/brand.md` holds the palette (light + dark, contrast checked), the type scale, the logo SVG, and the shimmer and motion specs.
    - Tailwind theme tokens and shadcn theme from the brand, plus a small preview page showing them.
    - You approve it.
  - Verify: All text pairs pass WCAG AA contrast (automated check). You sign off.
  - Files: `work/PAR-1/brand.md`, `apps/web/src/styles/tokens.css`, `apps/web/public/logo.svg`, `apps/web/src/routes/dev.brand.tsx` (`beforeLoad` throws `notFound()` outside dev)
  - Deps: T1 · Skills: `emil-design-eng`, `apple-design` · Owner: approve
  - Can run in parallel with T5–T12.

- [ ] **T5: Template parser: markdown → typed tree** (M)
  - Accept:
    - `pnpm documents:build` parses all 12 templates + the NDA cover page into `generated/*.json`, using remark + rehype-raw.
    - Node types: section, clause (with its id, like `2.1`), paragraph, text, strong, linkedTerm (`{term, kind}`), definition. The tree is checked with a Zod schema.
    - A round-trip test: joining the text of the tree gives the template's text byte for byte.
  - Verify: `pnpm --filter documents test`. All 12 parse, and the snapshot of the tree is reviewed.
  - Files: `packages/documents/src/parse/{parse.ts,schema.ts}`, `scripts/build.ts`, `test/parse.test.ts`
  - Deps: T1

- [ ] **T6: Field system, `defineDocument` and the render model** (M)
  - Accept:
    - Field builders (`text`, `longText`, `party`, `date`, `duration`, `money`, `choice`, `jurisdiction`). Each holds a Zod schema with its label and help text in `.meta()`, plus an optional default. There is a draft schema (`.exactPartial()`) and a complete schema. A test checks that `z.toJSONSchema` keeps the label and help text for the AI tools.
    - `render(definition, values) → RenderedDocument`. A missing value renders as a placeholder, and a linked term renders the value of its field.
    - `applyFieldChanges(values, changes) → {values, applied, rejected, inverse}` validates the changes and returns their inverse for undo. Property tests with fast-check.
  - Verify: `pnpm --filter documents test:coverage` shows 100% lines and branches.
  - Files: `packages/documents/src/{fields.ts,define.ts,render.ts,changes.ts}`, `test/*.test.ts`
  - Deps: T5 · Also: ADR-001 (the Worker entry), ADR-002 (the document engine)

- [ ] **T7: Mutual NDA definition (official cover page)** (S)
  - Accept:
    - The NDA fields match the official cover page: purpose, effective date, MNDA term, confidentiality term, governing law + jurisdiction, modifications, and 2 parties.
    - The coverage test passes: every linked term in `Mutual-NDA.md` is filled by a field, and every field is used.
    - A fully filled example renders with no placeholders left.
  - Verify: `pnpm --filter documents test`
  - Files: `packages/documents/src/definitions/mutual-nda.ts`, `test/definitions.test.ts`
  - Deps: T6

- [ ] **T8: Cover pages: CSA, SLA, AI Addendum** (M)
- [ ] **T9: Cover pages: DPA, BAA** (M)
- [ ] **T10: Cover pages: Pilot, Design Partner, Partnership** (M)
- [ ] **T11: Cover pages: PSA, Software License** (M)
  - Accept (each task):
    - Each document has a definition. Its fields come from the terms linked in the template and from the template's definitions section, and each has plain-words help and sensible defaults.
    - The coverage test and the property tests pass. The cover page has the "Cover page by Parley, not by Common Paper" label.
    - A review note per document in `work/PAR-1/cover-pages.md` records the sources checked (the template and Common Paper's public docs) and any judgment calls.
  - Verify: `pnpm --filter documents test`. A fully filled example of each document renders cleanly.
  - Files: `packages/documents/src/definitions/<doc>.ts` (×2–3), `work/PAR-1/cover-pages.md`
  - Deps: T7 · The four tasks can run in parallel.

- [ ] **T12: Output builders: print HTML + DOCX** (M)
  - Accept:
    - `toPrintHtml(rendered)` makes a self-contained, print-styled HTML page (A4/Letter, page numbers, attribution footer).
    - `toDocx(rendered)` makes a DOCX with real headings, numbered clauses and a table for the cover page. It runs in workerd.
    - Snapshot tests exist for all 12 documents, fully filled.
  - Verify: `pnpm --filter documents test` + a Worker test that builds and parses the DOCX. A manual look at 3 documents in Word/LibreOffice.
  - Files: `packages/documents/src/output/{html.ts,docx.ts,print.css}`, `test/output.test.ts`
  - Deps: T6, T2 (for the go/no-go on the approach)

### Checkpoint 1
- [ ] All 12 documents render to preview, HTML and DOCX. `packages/documents` has 100% coverage.
- [ ] You have approved the brand.

---

## Phase 2: The wow path (a guest drafts an NDA by chat)

- [ ] **T13: DB package: schema, migrations and connection** (M)
  - Accept:
    - Drizzle schema: the Better-Auth tables, `draft`, `message`, `share` and `aiUsage`, with indexes for the sidebar queries and search.
    - `pnpm db:generate` / `db:migrate` (direct unpooled URL) work on local Postgres and on a Neon branch. A Hyperdrive config is created with `--caching-disabled`, with `localConnectionString` for dev. `pg` + `drizzle-orm/node-postgres`, and the client is made per request. The indexes follow spec §5 Database.
    - Integration tests: migrations up on an empty DB, and typed queries for draft CRUD.
  - Verify: `pnpm --filter db test` against local PG.
  - Files: `packages/db/src/{schema.ts,client.ts,queries/drafts.ts}`, `drizzle.config.ts`, `test/*.test.ts`
  - Deps: T1 · Owner: Neon project · Skills: `neon:neon-postgres`

- [ ] **T14: Worker API: Better-Auth guest sessions + oRPC drafts** (M)
  - Accept:
    - Better-Auth is mounted at `/api/auth/*` with the `anonymous()` plugin. The first visit that needs a session creates a guest.
    - oRPC `drafts.create`, `drafts.get` and `drafts.updateFields` (through `applyFieldChanges`) enforce ownership.
    - Hono follows spec §5 Hono: `app.route()` sub-apps, typed Bindings/Variables, oRPC mounted as middleware, and `requestId` + `contextStorage` + `secureHeaders` (+ `timing` on preview).
    - The oRPC bases are `pub`, `authed` and `draftOwner`, using RequestHeaders/ResponseHeaders plugins and typed `.errors()`. `enable_request_signal` is set. SSR uses an in-process `createRouterClient` (no self-HTTP).
    - An auth-matrix test harness exists (no session, guest, other user, owner), with the first rows written. It calls procedures through server-side clients.
  - Verify: `pnpm test:workers`
  - Files: `apps/web/src/server/{app.ts,auth.ts,rpc/router.ts,rpc/drafts.ts}`, `test/auth-matrix.test.ts`
  - Deps: T13, T6 · Skills: `better-auth-best-practices`, `cloudflare:workers-best-practices`, `api-and-interface-design`

- [ ] **T15: App shell: three panes, responsive** (M)
  - Accept:
    - The shell is built from shadcn `Sidebar` + `Resizable` (spec §5 UI). No hand-built layout parts.
    - The Claude-style layout: a collapsible sidebar, the chat column, and a resizable document panel that you can close. On a phone, a drawer and two tabs.
    - The routes follow spec §5 Routing: the `_app` pathless shell, `/` and `/d/$draftId`, router context (`queryClient`, `orpc`, `session`), loaders using `ensureQueryData` + `useSuspenseQuery`, typed `panel`/`tab`/`field` search params, pending/error/not-found components, `autoCodeSplitting` and intent preload. Built with shadcn on the brand tokens.
    - There is no layout shift on load (CLS 0 in a DevTools trace), and it works with the keyboard.
    - The UI store follows the spec's Zustand rules: a store per request made with `createStore` + context, and URL state in search params. A Worker test renders two requests at once and checks that no state leaks between them.
  - Verify: component tests (Vitest browser mode) + a Playwright screenshot at 1440/1024/375 px.
  - Files: `apps/web/src/routes/{__root.tsx,_app.tsx,_app/index.tsx,_app/d.$draftId.tsx}`, `src/routes/-components/shell/*`
  - Deps: T4, T14 · Skills: `shadcn`, `frontend-ui-engineering`

- [ ] **T16: Live document preview + manual field editing** (M)
  - Accept:
    - The panel renders the `RenderedDocument`. Placeholders are clear, and a linked term shows its value on hover.
    - Clicking a field opens an inline editor built from the spec §5 Forms kit (`useAppForm`, field components per type, a `withFieldGroup` for `party`/`jurisdiction`, `onDynamic` + `revalidateLogic()`, linked fields). Saving calls `drafts.updateFields` with an optimistic update, and server errors show on the field.
    - A user can fill a whole NDA by hand, and the values survive a reload.
  - Verify: component tests + an e2e test that fills the NDA by hand.
  - Files: `apps/web/src/lib/form.ts`, `src/features/document-preview/*`, `src/features/field-editor/{fields/*,groups/*}`
  - Deps: T15, T7

- [ ] **T17: AI chat streaming with tools** (M)
  - Accept:
    - The chat uses `MessageScroller`, `Message`, `Bubble` and `Marker`, and assistant text uses `typeset-chat`. Component tests use `@shadcn/helpers/ai-sdk` `createChat()` scripts, including tool parts.
    - `chat.send` streams AI SDK v7 `streamText` over oRPC (`streamToEventIterator`). The client uses `useChat` with an oRPC transport (`eventIteratorToUnproxiedDataStream`). Messages are saved.
    - Tools `chooseDocument` and `updateFields` run on the server. `updateFields` is made from the `drafts.updateFields` procedure with `@orpc/ai-sdk` `createToolFactory`, so it shares the schema, the owner check and `applyFieldChanges`. The preview updates from the tool results. `streamText` gets `abortSignal: request.signal`, and a Worker test aborts halfway and checks the model stream stops.
    - The fake LLM runs Worker tests of a whole scripted NDA conversation.
  - Verify: `pnpm test:workers` + one manual chat with the real `gpt-6-luna` through the test key.
  - Files: `apps/web/src/server/ai/{chat.ts,tools.ts,prompt.ts,model.ts}`, `src/features/chat/*`, `test/chat.test.ts`
  - Deps: T16 · Owner: OpenRouter keys · Skills: `ai-sdk`

- [ ] **T18: Wow motion: shimmer, scroll-to-field, clause swap, undo markers** (M)
  - Accept:
    - The field shimmer is the shadcn `shimmer` utility tuned to the brand. `scroll-fade` is on the chat, the document and the sidebar.
    - A changed field shimmers (to the brand spec), the panel scrolls smoothly to it, and a choice swaps with a layout animation. There is no jank during streaming.
    - Each AI change shows as a shadcn `Marker` ("Term → 2 years") with an Undo button, and the status markers use `role="status"` + `shimmer`. Undo applies the inverse change set on the server.
    - Reduced-motion mode: the change is shown with no movement.
  - Verify: component tests + a DevTools performance trace (no long tasks over 50 ms while streaming) + a Claude in Chrome feel check.
  - Files: `apps/web/src/features/document-preview/motion.tsx`, `src/features/chat/change-marker.tsx`, `src/stores/ui.ts`
  - Deps: T17 · Skills: `emil-design-eng`, `find-animation-opportunities`, `review-animations`

- [ ] **T19: AI questionnaire, completion and guardrails** (M)
  - Accept:
    - `askQuestions` is a client-side human-in-the-loop tool that renders the shadcn `Questionnaire` inline (steps, letter shortcuts, Other, skip, conditional items). The answers go back through `addToolOutput`, are checked with Zod on the server, and survive a reload. `markComplete` shows an "Export" card.
    - The system prompt has the guardrails: on topic only, "not legal advice", and a short redirect for off-topic requests. The stable prefix is cached by the provider. There are server limits on message and history length.
    - Worker tests cover an off-topic request, a prompt injection attempt, and a message that is too long.
  - Verify: `pnpm test:workers`
  - Files: `apps/web/src/server/ai/{prompt.ts,tools.ts}`, `src/features/chat/ai-questionnaire.tsx`
  - Deps: T17

- [ ] **T20: AI evals v1 (NDA + choosing a document)** (S)
  - Accept:
    - `pnpm evals` runs 12 or more conversations with the real model: picking the right document from a situation, and filling the NDA end to end.
    - It reports the % correct document, the % correct fields, invalid writes, and the cost per conversation to `evals/report.md`.
    - The bar for the NDA and document choice is met.
  - Verify: `pnpm evals` passes the bar.
  - Files: `evals/{runner.ts,cases/*.ts,report.md}`
  - Deps: T19

### Checkpoint 2: **stop for owner review (demo)**
- [ ] On a local run, a guest drafts a complete NDA by chat and sees the live shimmer, the undo markers, and the inline questionnaire.
- [ ] `pnpm check`, all tests and the evals are green. You have tried it yourself.

---

## Phase 3: Accounts

- [ ] **T21: Sign up / sign in / sign out + guest → account linking** (M)
  - Accept:
    - Following spec §5 Auth: `better-auth/minimal`, email + password with a verification email, Google and GitHub, `lastLoginMethod` ("Last used" badge), `captcha` with Turnstile on sign-up and sign-in, the DB rate limiter with `cf-connecting-ip`, `backgroundTasks` → `waitUntil`, and `tanstackStartCookies` last. The session is fetched on the server through a `createServerFn` in the `_app` `beforeLoad`.
    - `onLinkAccount` moves the guest's drafts and messages to the new user in one transaction, and the draft stays open. Export, share and upgrade return `EMAIL_NOT_VERIFIED` until the email is verified.
    - Auth-matrix rows are added. Integration tests cover the link path, the verification gate and the rate limits.
  - Verify: `pnpm test:workers` + e2e: guest → draft → sign up → same draft → verify the email (Resend test inbox) → export unlocked. Also a Google sign-in on the preview.
  - Files: `apps/web/src/server/auth.ts`, `src/routes/{_auth.tsx,_auth/sign-in.tsx,_auth/sign-up.tsx,_auth/verify-email.tsx,_app/_authed.tsx}`, `src/features/auth/*`, `emails/verify-email.tsx`, `test/link.test.ts`
  - Deps: T14 · Owner: Resend domain, OAuth apps · Skills: `create-auth`, `better-auth-security-best-practices`, `resend:resend`, `resend:react-email`

- [ ] **T22: Sidebar history + search + draft actions** (M)
  - Accept:
    - The sidebar lists drafts grouped as Today / Yesterday / Last 7 days / Older (Temporal, in the user's time zone). "View all" leads to `/drafts`.
    - Search runs over titles, document types and party names, using the generated `tsvector` + GIN index with prefix matching, and debounce. `EXPLAIN` shows an index scan.
    - Rename, duplicate and delete (with an undo toast) work from the sidebar and from the title menu.
  - Verify: integration tests for the queries + component tests + e2e.
  - Files: `packages/db/src/queries/drafts.ts`, `apps/web/src/server/rpc/drafts.ts`, `src/features/sidebar/*`, `src/routes/_app/_authed/drafts.tsx` (`validateSearch`: `q`, `type` with `.catch()`)
  - Deps: T21

- [ ] **T23: Account menu, settings and password/email flows** (M)
  - Accept:
    - The account menu has your name, a plan badge, settings, billing (a placeholder until T26), and sign out.
    - Forgot/reset password (a 30-min single-use token, other sessions revoked). Change password (optionally revoke other sessions). Set a password for OAuth-only users. Change email (confirm with the current email first). Change name. A session list with revoke. Delete account (fresh session + confirm, all data removed).
    - Integration tests for each flow + audit log entries (IDs only). The emails are React Email templates.
  - Files: `apps/web/src/features/account/*`, `src/routes/{_app/_authed/settings.tsx,_auth/forgot-password.tsx,_auth/reset-password.tsx}`, `emails/{reset-password,change-email}.tsx`
  - Verify: tests + e2e.
  - Files: `apps/web/src/features/account/*`, `src/routes/_app/_authed/settings.tsx`, `src/server/rpc/account.ts`
  - Deps: T21

- [ ] **T23b: Two-factor authentication** (S)
  - Accept:
    - `twoFactor` plugin: enable with a password → QR code + 10 backup codes (shown once, with copy and download) → turned on only after the first TOTP check succeeds. Disable with a password.
    - Sign-in with 2FA: `twoFactorRedirect` → `/two-factor` (`InputOTP` for the TOTP or a backup code, "Trust this device for 30 days").
    - Tests: enable → sign out → sign in needs a code → a backup code works once → disable.
  - Verify: integration tests + e2e with a TOTP made in the test from the secret.
  - Files: `apps/web/src/server/auth.ts`, `src/routes/_auth/two-factor.tsx`, `src/features/account/two-factor/*`
  - Deps: T23 · Skills: `two-factor-authentication-best-practices`

### Checkpoint 3
- [ ] A guest's work survives sign-in. History, search and settings work on desktop and on a phone.

---

## Phase 4: Export, share, billing

- [ ] **T24: Export PDF + DOCX with quota** (M)
  - Accept:
    - `export.pdf` (Browser Run from `toPrintHtml`) and `export.docx` stream a download named `<Title> – <Document>.pdf`.
    - The first export sets `firstExportedAt` and counts toward the 3 free documents a month. Re-exports are free. DOCX needs Pro.
    - Limit states show a clear message with an upgrade call to action.
  - Verify: Worker tests for the quota math + a real-service test that parses the PDF and DOCX back.
  - Files: `apps/web/src/server/rpc/export.ts`, `src/server/quota.ts`, `src/features/export/*`
  - Deps: T12, T21

- [ ] **T25: Share links** (M)
  - Accept:
    - `share.create` and `share.revoke` use a random 128-bit token. `/s/$token` is a public, read-only SSR page with `noindex`, the attribution, and a "Draft your own" call to action.
    - A revoked or unknown token gives a friendly 404. The auth matrix covers these calls.
    - The Share button in the document panel copies the link, with a toast.
  - Verify: Worker tests + e2e (create → open while logged out → revoke → 404).
  - Files: `apps/web/src/server/rpc/share.ts`, `src/routes/s.$token.tsx`, `src/features/share/*`
  - Deps: T21, T16

- [ ] **T26: Polar sandbox: Pro plan** (M)
  - Accept:
    - `@polar-sh/better-auth` with `checkout`, `portal` and `webhooks`. The Pro product is set up in the sandbox. There is a `/pricing` page.
    - Webhooks turn Pro on and off (subscription active or canceled). Gating (DOCX, unlimited documents, higher daily limits) reads the plan.
    - Integration tests use real sandbox webhook payloads, with the signature checked.
  - Verify: tests + a real sandbox run: checkout with a test card → Pro → cancel in the portal → Free.
  - Files: `apps/web/src/server/{auth.ts,billing.ts}`, `src/routes/pricing.tsx`, `src/features/billing/*`
  - Deps: T24 · Owner: Polar sandbox

### Checkpoint 4
- [ ] Export, share and upgrade all work end to end with the real sandbox services.

---

## Phase 5: Cost and abuse

- [ ] **T27: Turnstile, rate limits, AI budgets** (M)
  - Accept:
    - Turnstile runs before a guest's first message through Better Auth's `captcha` plugin on `/sign-in/anonymous` (no separate siteverify code). The Rate Limiting binding allows 10 requests per 10 s on the AI routes, through `CloudflareRateLimiter` + the oRPC rate-limit middleware and headers plugin. The typed `RATE_LIMITED` / `DAILY_LIMIT` errors drive the UI.
    - Per-user daily message limits (guest 20, free 100, Pro 500) and cost tracking in `aiUsage`. Friendly messages when a limit is hit.
    - Worker tests cover each limit at its edge.
  - Verify: `pnpm test:workers` + a manual burst test on the preview.
  - Files: `apps/web/src/server/limits.ts`, `wrangler.jsonc`, `src/features/chat/limit-banner.tsx`
  - Deps: T17, T21 · Skills: `cloudflare:turnstile-spin`, `security-and-hardening`

- [ ] **T28: Cron: purge old guest data** (S)
  - Accept:
    - `scheduled()` deletes guests (and their data) after 7 days without activity, and expired sessions. It is idempotent and batched.
    - A Worker test uses a fake clock.
  - Verify: `pnpm test:workers`
  - Files: `apps/web/src/server/cron.ts`, `src/server.ts`, `test/cron.test.ts`
  - Deps: T21

- [ ] **T29: Observability** (S)
  - Accept:
    - Structured JSON logs with a request id, route, status, latency and user tier. **No field values or chat text.**
    - AI metrics: tokens, cost, time to first token and tool errors for each chat turn. They show up in Workers Observability.
    - A test checks the log redaction.
  - Verify: tests + a query in Workers Observability after a chat on the preview.
  - Files: `apps/web/src/server/{log.ts,middleware.ts}`, `src/server/ai/chat.ts`
  - Deps: T17 · Skills: `observability-and-instrumentation`

### Checkpoint 5
- [ ] The budget can't be exceeded (tested). Logs are clean of personal data. The cron is verified.

---

## Phase 6: All 12 documents in chat

- [ ] **T30: AI across all 12 documents** (M)
  - Accept:
    - The prompt and tools cover all 12 documents, including suggestions of related documents (for example CSA → SLA / DPA / AI Addendum).
    - Evals grow to 30 or more cases with at least 2 per document. The bar is met: correct document ≥ 90%, correct fields ≥ 95%, invalid writes 0.
    - The cost per finished document is recorded (goal: an NDA under $0.02).
  - Verify: `pnpm evals`
  - Files: `apps/web/src/server/ai/prompt.ts`, `evals/cases/*.ts`, `evals/report.md`
  - Deps: T8–T11, T20

- [ ] **T31: Real export of all 12 documents + visual checks** (S)
  - Accept:
    - `test:real` builds a real PDF (Browser Run) and DOCX for all 12 documents, fully filled, and parses them back to check the text and page count.
    - The PDF pages are turned into PNG and compared with approved baselines.
  - Verify: `pnpm test:real`
  - Files: `apps/web/test/real/export.real.test.ts`, `test/real/baselines/*`
  - Deps: T24, T30

### Checkpoint 6: **stop for owner review**
- [ ] All 12 documents can be drafted by chat and exported. The eval report is shared with you.

---

## Phase 7: Test depth

- [ ] **T32: Full e2e: every user story × 3 browsers × desktop/phone + a11y** (M)
  - Accept:
    - The Playwright specs cover user stories 1–11 with the fake LLM, sharded to fit the 20-minute build limit.
    - Every page and state has zero serious or critical axe violations. The golden path is tested keyboard-only and in reduced-motion mode.
    - Visual baselines in light and dark mode for the key screens.
  - Verify: `pnpm test:e2e` is green on a PR preview.
  - Files: `apps/web/e2e/*.spec.ts`, `e2e/fixtures/*`
  - Deps: Phases 3–6 · Skills: `browser-testing-with-devtools`

- [ ] **T33: Real-service suite + nightly + a Neon branch per PR** (M)
  - Accept:
    - `test:real` runs a real-LLM NDA from start to PDF, a Polar sandbox checkout, a Resend OTP, and a Turnstile test, on every PR against a fresh Neon branch.
    - Nightly runs all 12 documents with the real LLM, plus the evals, mutation tests, the load test and a real Turnstile check. It sends a report link.
    - After deploy, a smoke test runs on the live site.
  - Verify: A PR run and a nightly run are both green, with the costs recorded.
  - Files: `scripts/ci-*.sh`, `apps/web/test/real/*`, `apps/web/e2e/smoke.prod.spec.ts`
  - Deps: T3, T32 · Skills: `neon:neon-postgres-branches`, `ci-cd-and-automation`

- [ ] **T34: Coverage gates + mutation testing** (S)
  - Accept:
    - The Vitest coverage thresholds from the spec are enforced in CI.
    - Stryker on `packages/documents`, quota and auth reaches a score of 85% or more. Surviving mutants are fixed or documented.
  - Verify: `pnpm test:coverage && pnpm test:mutation`
  - Files: `vite.config.ts` (`test.projects` coverage thresholds), `apps/web-worker-tests/vitest.config.ts` (Istanbul), `stryker.config.mjs`
  - Deps: T32

- [ ] **T35: Performance budgets + load test** (S)
  - Accept:
    - `neon inspect db` (outliers, seq-scans, unused-indexes) is clean. Time to first token is measured with and without `placement.region`.
    - Lighthouse CI on the preview: LCP under 2.0 s, CLS under 0.05, and all categories 95 or more. Time to first AI token p50 under 1.5 s. JS budget per route.
    - A k6 burst of 50 concurrent chats: the limits hold and there are no 5xx errors.
    - The TanStack devtools are not in the production bundle (tested).
  - Verify: `pnpm test:perf` + the k6 report.
  - Files: `lighthouserc.json`, `load/chat.k6.js`
  - Deps: T32 · Skills: `performance-optimization`, `cloudflare:web-perf`

- [ ] **T36: Exploratory QA pass** (S)
  - Accept:
    - An agent-browser dogfood run over all the user journeys and edge cases. A Claude in Chrome check of the feel and layout at many sizes. A Chrome DevTools check for memory leaks over a 100-message chat.
    - Every bug found is filed as `wi new --origin PAR-1` and fixed or planned.
  - Verify: The QA report is in `work/PAR-1/qa.md`.
  - Files: `work/PAR-1/qa.md`
  - Deps: T32 · Skills: `agent-browser`

### Checkpoint 7
- [ ] All the quality gates are green. There are no open high-severity bugs.

---

## Phase 8: Launch

- [ ] **T37: Empty-state and first-run polish** (S)
  - Accept:
    - `/` shows a warm start: starter prompts ("I'm sharing a roadmap with a vendor…") and a gallery of the 12 documents with one-line descriptions. You can start in one click.
    - The Common Paper credit and the "not legal advice" note are shown clearly.
  - Verify: e2e + a Claude in Chrome feel check.
  - Files: `apps/web/src/routes/index.tsx`, `src/features/empty-state/*`
  - Deps: T30

- [ ] **T38: Production environment on `parley.runtimedrift.dev`** (M)
  - Accept:
    - A Custom Domain on the Worker, the production Neon branch and Hyperdrive, all secrets set, the Polar sandbox production config, and a Resend sending domain.
    - Security headers (CSP, HSTS, frame-ancestors, referrer policy): Hono `secureHeaders()` on `/api`, and the same policy on the SSR responses in `src/server.ts`. The auth trusted origins are set.
    - The post-deploy smoke test is green on the live domain.
  - Verify: The smoke test + securityheaders.com at A or better.
  - Files: `apps/web/wrangler.jsonc`, `src/server/headers.ts`
  - Deps: T33 · Skills: `cloudflare:wrangler`, `security-and-hardening`

- [ ] **T39: README + ADRs** (M)
  - Accept:
    - README: a 30-second GIF, the architecture diagram, "how it works", the eval score, the cost per document, the test pyramid, and a local setup in 3 commands or fewer.
    - ADRs 001–00N for every decision made (Worker entry, document engine, PDF through Browser Run, guest auth, cost limits, CI).
  - Verify: A fresh clone → local setup in 3 or fewer commands works (tested in a clean container).
  - Files: `README.md`, `docs/adr/*.md`, `docs/architecture.svg`
  - Deps: T38 · Skills: `documentation-and-adrs`

- [ ] **T40: `/ship`** (S)
  - Accept: The `/ship` checklist gives a GO. The launch is tagged `v1.0.0`, with a changelog entry.
  - Verify: `/ship` report.
  - Deps: T39

### Checkpoint: Complete
- [ ] Every success criterion in spec §8 is checked with evidence.
