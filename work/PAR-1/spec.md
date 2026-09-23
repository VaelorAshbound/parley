# Spec: Parley

> Status: draft for review · Work item: PAR-1 · Intent: [intent.md](intent.md)

## 1. Objective

Parley is an AI SaaS app for drafting legal agreements. You chat about what you need. Parley picks the right Common Paper agreement and helps you fill it in. The real document updates live next to the chat. At the end you download it or share a link.

It is a portfolio piece. Two audiences must say "wow" without any explanation:

- **Client (Fiverr/Upwork):** opens the live link and has a finished NDA in about 2 minutes, with no sign-up.
- **Engineer/recruiter:** opens the repo and finds it typed end to end, tested, documented and cheap to run.

### Layout (like the Claude app)

Three panes on desktop:

```
┌──────────────┬──────────────────────────┬──────────────────────────┐
│ ◧ Parley     │ Draft title ▾         ◫  │ Mutual NDA ▾  Share ⤓ ⤢ ✕│
│ 🔍 Search    │                          │                          │
│ ＋ New draft │        chat              │     live document        │
│              │                          │                          │
│ Today        │                          │                          │
│  Acme NDA    │                          │                          │
│ Last 7 days  │                          │                          │
│  Pilot w/ Bo │                          │                          │
│ View all     │ ┌──────────────────────┐ │                          │
│ (A) Ana·Free▾│ │ Reply…             ⏎ │ │                          │
└──────────────┴──────────────────────────┴──────────────────────────┘
```

- **Left sidebar.** It can be collapsed. It holds:
  - search, over draft titles, document types and party names;
  - a **New draft** button;
  - the draft history, grouped as Today / Yesterday / Last 7 days / Older, with a "View all" link;
  - the account menu at the bottom: name, plan badge, settings, billing (Polar portal), sign out.

  Guests see their one draft and a "Sign in to save" button there.
- **Middle: chat.** The draft title sits at the top. Its menu has rename, duplicate and delete. The reply box sits at the bottom, with the "not legal advice" line under it.
- **Right: live document panel.** Its header has the document type, **Share**, **Download** (PDF/DOCX), expand to full width, and close. You can resize the panel. When it is closed, a card in the chat opens it again.
- **Phone.** The sidebar becomes a drawer. Chat and document become two tabs, and the document tab shows a badge when it changes.

### The wow moment

Chat in the middle, the live document on the right. As you talk:

- the field that changed shimmers in the document, and the page scrolls to it smoothly;
- choices (such as "1 year" vs "until terminated") swap in the document with smooth motion;
- the AI explains each choice in plain words ("Perpetual means the secret never expires…");
- every change the AI makes shows as a small chip in the chat ("Term → 2 years · Undo").

Everything else must be flawless around this moment.

### User stories

1. As a **guest**, I can start chatting at once, with no sign-up, and see a draft fill in live.
2. As a user who **doesn't know which document** they need, I describe my situation and the AI suggests one, with a one-line reason. It can also mention related ones (for example: "a CSA usually comes with an SLA and a DPA").
3. As a user, I can **answer with quick-reply buttons** when the question has fixed options.
4. As a user, I can **click any field in the document and edit it myself**. The AI sees my edit.
5. As a user, I can **undo** any change the AI made.
6. As a guest, when I want to save or export, I **sign in and keep my draft and chat**, with nothing lost.
7. As a signed-in user, I see **my drafts** in the sidebar, can **search** them, and can reopen, duplicate, rename or delete them.
8. As a user, I can **download a PDF or DOCX** that looks like a real, professional contract.
9. As a user, I can make a **read-only share link** and turn it off later.
10. As a free user, I can finish **3 documents a month**. After that I can **upgrade to Pro** (Polar sandbox) for unlimited documents and DOCX.
11. On a **phone**, I can do all of this: the sidebar is a drawer, and chat and document are two tabs.

### The 12 documents

All 12 from `catalog.json` ship at launch.

- The **standard terms stay unchanged**, word for word.
- The **NDA** uses its official Common Paper cover page.
- The **other 11** get a cover page that **we write**. Each one lists the variables its template refers to (the `coverpage_link`, `keyterms_link`, `orderform_link`, `sow_link` and `businessterms_link` spans), in the NDA cover page's style.
- Every cover page we wrote is labeled "Cover page by Parley, not by Common Paper". This keeps us inside CC BY 4.0.

| Document | Linked terms to cover |
|---|---|
| Mutual NDA (+ official cover page) | 6 |
| AI Addendum | 8 |
| BAA | 8 |
| SLA | 9 |
| Pilot Agreement | 10 |
| Design Partner Agreement | 11 |
| CSA | 13 |
| DPA | 14 |
| Partnership Agreement | 19 |
| Software License Agreement | 22 |
| PSA | 26 |

### Out of scope

- Real e-signing: signer emails, audit trail, legal validity.
- Changing the standard terms.
- Custom or uploaded templates.
- Negotiation with the other party inside the app.
- Languages other than English.
- Non-US law.
- Teams and organizations.

## 2. Tech stack

This is the standard stack from CLAUDE.md. The versions below were checked on 2026-09-22.

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + **Vite+** (`vp`, v1.0 RC): Rolldown, Vitest, oxlint, oxfmt |
| App | **TanStack Start** (React 19 + React Compiler), TanStack Router / Query / Form |
| UI | Tailwind CSS, shadcn/ui, Motion |
| Client state | Zustand, used only for UI state: active tab, highlighted field, and the undo stack |
| API | **Hono** + **oRPC**, typed from the DB to the UI, with Zod at every edge |
| AI | **AI SDK v7** (`streamText` + tools, `useChat`) over oRPC (`streamToEventIterator` / `eventIteratorToUnproxiedDataStream`) and **OpenRouter** (`@openrouter/ai-sdk-provider`) |
| Auth | **Better-Auth**: `anonymous()` for guests, with `onLinkAccount` moving the guest's drafts to the new account. Sign-in by email OTP (Resend), Google and GitHub. |
| Payments | **Polar sandbox** through `@polar-sh/better-auth`: `checkout`, `portal` and `webhooks` |
| DB | **Neon Postgres** through Hyperdrive, **Drizzle** ORM. Local Postgres for dev. |
| Export | **DOCX**: `docx` (`Packer.toArrayBuffer`). **PDF**: Cloudflare **Browser Run** `quickAction("pdf", { html })`, using the same HTML as the preview. |
| Abuse and cost | Turnstile before a guest's first message. Workers Rate Limiting binding. A per-user daily AI budget kept in Postgres. A hard monthly credit limit on the OpenRouter key. |
| Dates | Temporal through `temporal-polyfill`. Workers and Safari don't have it natively yet. |
| Email | Resend + React Email for sign-in codes |
| Hosting | One Cloudflare Worker on `parley.runtimedrift.dev`. CI with Workers Builds, and a Workers Preview for every PR. |
| Tests | Vitest (unit and integration), Playwright (e2e), AI evals on Vitest |

### Architecture

```
Browser ──► Cloudflare Worker (src/server.ts)
              ├─ /api/*  → Hono ─┬─ /api/auth/*  Better-Auth (+ Polar webhooks)
              │                  └─ /api/rpc/*   oRPC router (drafts, chat stream, export, share)
              ├─ everything else → TanStack Start SSR handler
              └─ scheduled()     → cron: purge old guest data
                    │
                    ├─ Hyperdrive → Neon Postgres
                    ├─ OpenRouter (LLM)
                    ├─ Browser Run (PDF)
                    └─ Rate Limiting, Turnstile, Resend
```

**Recorded decision: why a custom server entry.**

- Cloudflare's official TanStack Start guide supports a custom `main` entry. We need one anyway for `scheduled()`, which runs the guest cleanup.
- Sending `/api/*` to Hono inside that entry is a small step. It is not a documented recipe. We chose it because it gives auth, RPC and webhooks one middleware stack: logging, rate limits and errors.

### Document engine (`packages/documents`)

This is the core. It is pure TypeScript with no I/O, so it is easy to test.

1. **Parse at build time.** A build step (remark + rehype-raw) turns each template `.md` into a typed JSON tree: sections, clauses, text, and linked-term nodes. The app never parses markdown at runtime.
2. **One definition per document** (`defineDocument`). It holds:
   - the catalog metadata;
   - the cover page sections;
   - each field's key, label, plain-words help, type, Zod schema and optional default;
   - a map from each linked term to the field that fills it.
3. **Build-time checks.** Every linked term in a template must map to a field, and every field must be used. A test fails if one is missing.
4. **Field types.** `text`, `longText`, `party` (name, title, company, address, email), `date`, `duration`, `money`, `choice` (single or multiple, with an optional "other" text), `jurisdiction` (US state + court).
5. **One render model, three outputs.** Draft values + definition → `RenderedDocument`. From that one model:
   - the React preview is rendered;
   - the PDF HTML is built;
   - the DOCX is built.

   A field with no value shows as a clear placeholder such as `[Governing law]`.

### AI design

- **Model.** `openai/gpt-6-luna` through OpenRouter, chosen by the owner. It supports tool calls and structured output and has a 1.05M-token context. It costs $0.10/M input, $0.50/M output and $0.01/M cached input (OpenRouter list, 2026-09-22). The model ID lives in one config value. The eval suite checks that it meets the bar below. If it misses, we bring that back to the owner and don't swap the model on our own.
- **Prompt.** The system prompt holds the catalog and the active document's field list, with its current values. The long, stable part is written so the provider can cache it.
- **Tools.** The server checks every tool input with Zod.
  - `chooseDocument({ documentId, reason })`
  - `updateFields({ changes: [{ key, value, explanation }] })`. Invalid values go back to the model as errors, never into the draft.
  - `askChoice({ question, options[] })` shows quick-reply buttons in the chat.
  - `markComplete()` runs when all required fields are valid, and suggests export.
- **Guardrails.** The AI stays on drafting these documents. It says in plain words that it gives no legal advice. Off-topic requests get a short redirect. The chat has a server-side limit on message length and history length.
- **Evals** (`pnpm evals`). About 30 scripted conversations, for example: "we're about to share our roadmap with a vendor" → Mutual NDA. They check the chosen document, the field values, and that no invalid values were set. They run in CI on prompt or model changes, and the score is shown in the README.

### Data model (Drizzle)

- Better-Auth tables: `user`, `session`, `account`, `verification`. An `isAnonymous` flag marks guests.
- `draft`: `id`, `userId`, `documentId`, `title`, `fields` (jsonb, checked against the document's Zod schema), `status` (`drafting` | `complete`), `createdAt`, `updatedAt`, `firstExportedAt`.
- `message`: `id`, `draftId`, `role`, `parts` (jsonb, the AI SDK `UIMessage` parts), `createdAt`.
- `share`: `token` (random, 128-bit), `draftId`, `createdAt`, `revokedAt`.
- `aiUsage`: `userId`, `day`, `inputTokens`, `outputTokens`, `costUsd`, used for the daily budget.

**Quota.** A document "counts" on its first export (`firstExportedAt`). Free users get 3 counted documents per calendar month (UTC). Pro users (an active Polar subscription) have no limit. Re-exporting a document that was already counted is always free.

### Limits (first values, changed through config)

| Who | Limit |
|---|---|
| Guest | Turnstile once. 20 AI messages a day. 1 draft. Must sign in to save, export or share. |
| Free | 100 AI messages a day. 3 counted documents a month. PDF only. |
| Pro | 500 AI messages a day. Unlimited documents. PDF + DOCX. |
| Everyone | 10 requests per 10 s per user or IP on AI routes. Hard monthly credit limit on the OpenRouter key. |

Guest users and their data are deleted after 7 days without activity (cron).

## 3. Commands

```bash
pnpm install                 # vp install under the hood
pnpm dev                     # vp dev: app + Worker locally (wrangler via @cloudflare/vite-plugin)
pnpm check                   # vp check: format + lint + type-check (type-aware)
pnpm test                    # vp test: all unit and integration tests
pnpm test:e2e                # playwright test (local, or PREVIEW_URL=... for a preview)
pnpm evals                   # AI eval suite (calls OpenRouter; not run on every commit)
pnpm build                   # vp run -r build
pnpm db:generate             # drizzle-kit generate
pnpm db:migrate              # drizzle-kit migrate
pnpm documents:build         # parse templates/*.md into typed JSON + run the coverage checks
pnpm deploy                  # wrangler deploy (normally done by Workers Builds)
```

Vite+ is at release candidate (RC), not GA, so there is a risk it changes. If it blocks us, we fall back to plain Vite + Vitest + oxlint + oxfmt, and we record the reason.

## 4. Project structure

```
parley/
├─ apps/web/                  TanStack Start app + the Worker
│  ├─ src/server.ts           Worker entry: /api → Hono, rest → Start, scheduled()
│  ├─ src/server/             Hono app, oRPC routers, AI chat, export, auth, polar
│  ├─ src/routes/             TanStack Router file routes (/, /d/$id, /drafts, /s/$token, /settings, /pricing)
│  ├─ src/components/         UI (shadcn in components/ui)
│  ├─ src/features/           chat/, document-preview/, drafts/, billing/
│  ├─ e2e/                    Playwright tests
│  └─ wrangler.jsonc
├─ packages/documents/        Document engine: definitions, render model, DOCX/HTML builders
│  ├─ src/definitions/        One file per document (12)
│  └─ generated/              Parsed template JSON (build output, not committed)
├─ packages/db/               Drizzle schema, migrations, typed queries
├─ evals/                     AI eval conversations + runner
├─ templates/                 Common Paper originals (unchanged) + LICENSE.txt
├─ catalog.json
├─ docs/adr/                  Architecture decision records
└─ work/PAR-1/                Intent, spec, plan, logs
```

## 5. Code style

- TypeScript `strict`. No `any` and no `as` casts outside tests.
- Zod schemas are the source of the types (`z.infer`).
- Names:
  - files are kebab-case;
  - components are PascalCase;
  - the database uses camelCase in TypeScript and snake_case in SQL.
- oxfmt and oxlint decide formatting and lint. No arguing by hand.
- Comments explain *why*, not *what*.
- Errors:
  - oRPC typed errors at the API edge;
  - no thrown strings;
  - users see short, human messages.

Example, a document definition:

```ts
export const mutualNda = defineDocument({
  id: "mutual-nda",
  template: "Mutual-NDA.md",
  coverPage: { source: "official", template: "Mutual-NDA-coverpage.md" },
  fields: {
    purpose: field.longText({
      label: "Purpose",
      help: "What each side may use the shared information for.",
      default: "Evaluating whether to enter into a business relationship with the other party.",
    }),
    mndaTerm: field.choice({
      label: "MNDA term",
      help: "How long the agreement itself lasts.",
      options: {
        fixed: { label: "Expires after a set time", with: field.duration({ default: { years: 1 } }) },
        untilTerminated: { label: "Until either party ends it" },
      },
    }),
    governingLaw: field.jurisdiction({ label: "Governing law & courts" }),
    party1: field.party({ label: "Party 1" }),
    party2: field.party({ label: "Party 2" }),
  },
  linkedTerms: { Purpose: "purpose", "MNDA Term": "mndaTerm", "Governing Law": "governingLaw.state" /* … */ },
});
```

## 6. Testing strategy

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Document engine: every definition covers every linked term; the render model; field schemas; the quota math; the Temporal date logic. Near 100% coverage in `packages/documents`. |
| Integration | Vitest + local Postgres | oRPC procedures against a real DB: draft ownership, guest → user linking, quota, share revoke, Polar webhook handling. The LLM is mocked with AI SDK `MockLanguageModel`. |
| Snapshot | Vitest | DOCX and PDF-HTML output of one fully filled example per document (12). |
| E2E | Playwright | The golden path, meaning a guest → NDA → sign in → PDF, on desktop and on a phone viewport. Also share link, upgrade (Polar sandbox) and undo. Runs against the Workers Preview on each PR. A fake LLM is used for speed and stable results. |
| Accessibility | axe (Playwright) | Zero serious/critical violations on every page. Chat and editor work with the keyboard only. |
| AI evals | Vitest runner | Correct document picked in 90% or more of cases. Correct field values in 95% or more. Zero invalid writes. |

Every bug fix starts with a failing test.

## 7. Boundaries

**Always**

- Run `pnpm check && pnpm test` before each commit.
- Check every input with Zod at the edge: RPC, tools, webhooks.
- Check who owns a draft on every draft read or write.
- Keep the standard terms byte-identical to `templates/`, and test this.
- Show the "not legal advice" note and the Common Paper credit in the app, the exports and the share page.
- Follow reduced-motion settings in every animation.
- Use commits in the form `<type>(PAR-1): <why>` on the `PAR-1-<slug>` branches.

**Ask first**

- Adding a dependency that is not in this spec.
- Database schema changes after the first migration ships.
- Changing the AI model or the limits.
- Changing CI/Workers Builds settings.
- Anything that costs money: a paid plan, a domain, more OpenRouter credit.

**Never**

- Commit secrets (`.dev.vars` and `.env` are in `.gitignore`).
- Change the Common Paper standard terms.
- Send a user's draft content to anything except the chosen LLM.
- Log document field values or chat text. Logs hold IDs and counts only.
- Remove or skip a failing test without approval.
- Let the LLM write fields without Zod validation.

## 8. Success criteria

**User (live app)**

- [ ] A guest finishes a Mutual NDA from the landing page in under 2 minutes, and a PDF downloads right after sign-in.
- [ ] All 12 documents can be picked by chat, filled, previewed and exported as PDF and DOCX.
- [ ] A field changes in the preview within 100 ms of the tool call arriving. There is no layout shift and no flash.
- [ ] First AI token appears in under 1.5 s (p50) and under 3 s (p95).
- [ ] Landing page: LCP under 2.0 s on 4G, CLS under 0.05, and Lighthouse 95 or more in every category.
- [ ] Works in the latest Chrome, Firefox and Safari, and at 375 px wide.

**Engineer (repo)**

- [ ] Types are strict from the DB to the UI (no `any`). `pnpm check` is clean.
- [ ] Unit, integration and e2e tests are green in CI. The eval score is shown in the README.
- [ ] README: a 30-second GIF, an architecture diagram, "how it works", and a local setup in 3 or fewer commands.
- [ ] ADRs exist for these decisions: server entry, the document engine, PDF through Browser Run, guest auth, and cost limits.

**Exec (cost)**

- [ ] The only fixed cost is the Workers Paid plan ($5/mo). Neon scales to zero, and nothing else costs money while idle.
- [ ] The AI spend can't go past the OpenRouter key limit, whatever the traffic.
- [ ] Cost per finished NDA is measured and shown in the README (goal: under $0.02).

## 9. Decisions and open questions

**Decided**

- **Domain:** `parley.runtimedrift.dev`. It is a Custom Domain on the Worker, and the cert and DNS are handled by Cloudflare.
- **Name:** Parley.
- **Brand (colors, logo, type):** designed as its own step after the plan is approved and before the build starts.

**Open**

1. **The PDF test** (Browser Run) and **the DOCX test** (`docx` has not been checked on Workers yet) are the first tasks in the plan. If either fails, we come back here before building on it.
