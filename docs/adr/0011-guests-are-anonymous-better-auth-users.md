# ADR-0011: Guests are anonymous Better Auth users, linked to the account when they sign in

## Status

Accepted (spec approved 2026-09-23; built in T14, T15, T21, T27 and T28)

## Context

The first user story is "as a guest, I can start chatting at once, with no sign-up, and see a draft fill in live" (spec §1). The landing page is the chat. Sign-up comes only when the user wants to save, export or share, and then they must **keep their draft and chat, with nothing lost**.

A guest still costs money: every message is a model call. So a guest needs:

- an identity the server trusts, so every limit (daily messages, one draft, rate limits) has someone to count against;
- protection from bots that make guests in a loop to get free AI;
- a clean move of the draft to the account on sign-up or sign-in, by email, Google or GitHub, with or without two-factor;
- a way to go away, since most guests never come back.

## Decision

- **A guest is a real user row** with `isAnonymous = true`, made by Better Auth's `anonymous()` plugin. Every procedure, middleware and limit treats a guest like any other user. The ownership check (`draftOwner`) and the auth matrix tests have no special case.
- **Made on the first action that needs one**, not on page load (`_app` route, T15). Reading the landing page creates nothing, so crawlers and bots that only load pages never make users.
- **Turnstile once, before the guest exists.** The `captcha` plugin guards `/sign-in/anonymous` (also sign-up, sign-in, password reset and verification email). With the real widget a token counts only for the `auth` action on Parley's own host.
- **New guests per network are limited** by Better Auth's rate limiter on `/sign-in/anonymous`: in production 10, then none until an hour after the last one (`GUESTS_PER_NETWORK`, `src/server/limits.ts`). Previews (which pass every Turnstile token) allow 5 per 10 s.
- **Guest limits** (spec §2): 1 draft, 20 AI messages a day, no export, share or upgrade.
- **Linking: `onLinkAccount` moves the data.** When a guest signs up or signs in, Better Auth calls `linkGuest`, which moves the guest's drafts, chats and today's AI usage to the account in one transaction (`moveGuestData`), then Better Auth deletes the guest. If the move throws, the guest and its drafts stay, and the user can try again.
- **Two places where linking must not happen too early:**
  - **Email links never sign in** (`autoSignInAfterVerification: false`). Otherwise a guest who opened someone else's link would be signed in as them and hand over their draft (login CSRF).
  - **Two-factor before linking.** The two-factor plugin is listed before `anonymous`, so a password alone links nothing. The guest is carried to the code step in a signed 10-minute cookie and linked when the code signs in (`src/server/two-factor.ts`). Any other new session expires that cookie, so the next person to sign in on the same browser never gets the guest (PAR-20, ADR-0013).
- **Cleanup.** A daily cron (`src/server/cron.ts`, 03:17 UTC) deletes guests with no activity for 7 days, with everything they own, in batches of 500, plus expired sessions. Once a day, because each run wakes the Neon compute.

## Alternatives considered

### Guest state in the browser only (localStorage), uploaded on sign-up

- Pros: No guest rows in the database.
- Cons: The chat is a server stream with tool calls that write the draft, so the server needs the draft anyway. Limits per guest would be trust-the-client. An upload on sign-up is a second write path that must merge with the server's rules.
- Rejected.

### A signed guest cookie, not a user (our own session kind)

- Pros: No row until the first message.
- Cons: Every procedure would need two kinds of caller, and the draft table two kinds of owner. Our own session code next to Better Auth's is more security surface, not less.
- Rejected: the anonymous plugin gives the same thing inside the auth we already trust.

### Sign up before the first message

- Pros: Simplest. Every user has an email.
- Cons: Breaks the first user story. The "wow" of the product is seeing the draft fill in before any form.
- Rejected.

### A guest on page load

- Pros: The session is there before the first click.
- Cons: Every crawler, preview bot and link unfurler makes a user. Turnstile needs a real user action to run.
- Rejected.

## Consequences

- Guest rows live in the `user` table until the cron removes them. The daily cleanup caps a run at 10,000 rows per kind, and the log line says when more are left.
- A guest who signs in to an account that already has drafts keeps all of them: the guest's draft is added, not merged.
- The guest's AI usage moves too: its messages are added to the account's row for the same day, so signing up doesn't reset today's limit, and the cost records stay complete.
- The guest flow is tested end to end (`e2e/first-run.spec.ts`, `e2e/auth.spec.ts`), the move in the DB tests (`packages/db/test/guests.test.ts`), and the linking edge cases (two-factor, Google and GitHub, email links, Turnstile) in the Worker tests (`apps/web-worker-tests/test/link.test.ts`, `oauth.test.ts`, `turnstile.test.ts`).
