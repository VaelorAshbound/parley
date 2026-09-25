# ADR-0007: Share links are bearer tokens with one live link per draft

## Status

Accepted (built in T25, 2026-09-25)

## Context

Spec §2 user story 9: "I can make a read-only share link and turn it off later." The `share` table (T13) has `token` (128 random bits), `draft_id`, `created_at` and `revoked_at`. A link is a capability URL: whoever has it can read the draft, with no account. That makes it the easiest way into someone's data, so the design starts from how it could leak:

1. **Guessing** a token, or probing tokens and draft ids.
2. **Showing more than the document**: the chat, the owner, their other drafts, internal ids.
3. **Outliving revocation**: a CDN, Hyperdrive or the browser keeping the page after the link is off.
4. **Spreading the token**: search engines, the `Referer` header, other sites framing the page.

## Decision

- **Token:** 16 bytes from `crypto.getRandomValues`, base64url (22 letters), made in `@workspace/db` `queries/shares.ts`. The edge (`share.view`'s Zod input) accepts only that shape, so nothing else reaches the database (`BAD_REQUEST`). An unknown, revoked or deleted link is the same `NOT_FOUND`, and the page shows all of them as one friendly 404.
- **One live link per draft.** `share.create` gives the link that is on, or makes one, under a row lock on the draft, so two clicks give one link. `share.revoke` sets `revoked_at` on every live link of the draft; the row stays, so an old token never works again, and sharing again makes a new token.
- **Who may do what.** Creating a link needs a confirmed email, like export (spec §2 Limits: fake addresses must not use the public surface). Turning it off only needs ownership, so it is never blocked. Every owner query matches the user id too (spec §7). The auth matrix covers `share.get`, `share.create`, `share.view` and `share.revoke`.
- **The public read returns only what the page draws:** `title`, `documentId` and `values` (parsed by the document's own schema). No draft id, user, status, dates or messages. A Worker test checks the raw HTTP body holds none of them.
- **The page (`/s/:token`)** is outside the app shell and reads no session. Every answer, the 404 too, has `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow` (plus the robots meta tag), `Referrer-Policy: no-referrer` (plus the meta tag) and `frame-ancestors 'none'` / `X-Frame-Options: DENY`. Hyperdrive's query cache is off (spec §5), so turning a link off works on the next load.
- **Logs:** `share_created` and `share_revoked` (user and draft ids), `share_viewed` (found / not_found). Never the token.

## Alternatives Considered

### Store only a hash of the token

- Pros: A leaked `share` table alone gives no working links.
- Cons: The owner could never copy the same link again; every "Copy link" would make a new one and break links already sent. Anyone who can read the `share` table can read the `draft` table next to it, which is the content the link protects.
- Rejected: the hash protects almost nothing here and costs the main use case.

### Many links per draft (one per recipient)

- Pros: Turning off one person's link leaves the others.
- Cons: A list to manage in the UI and more to get wrong; the spec asks for one link to turn off.
- Rejected for v1. The table already allows it if we want it later.

### Signed, expiring URLs (HMAC of the draft id), no table

- Pros: No lookup for the signature check.
- Cons: Can't be turned off before they expire without a deny list, which is a table again.
- Rejected: revocation is the requirement.

### Guests may share

- Rejected: spec §2 Limits (guests sign in to save, export or share).

## Consequences

- Token guessing is not practical (2^128), but `share.view` and `/s/*` should still be in the per-IP rate limit so a burst of misses costs nothing: T27.
- Workers Logs' invocation records keep a request's path, and `/s/:token` puts the token there (`redact_query_string` covers only query strings). Only the account's operators can read those logs; T38 can add a Workers Logs field filter if that matters for production.
- A draft that had values in a section it no longer shows still sends those values (they are in the draft's fields). They are the owner's own document content, not another draft or the chat.
- `share.view`'s refusal for a rate limit (T27) would show as the same 404 on the page, since the loader maps every 4xx to not found.
