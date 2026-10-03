# Changelog

All notable changes to Parley. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-01

The first public release, live on [parley.runtimedrift.dev](https://parley.runtimedrift.dev).

### Added

- **Drafting by chat.** Describe a deal in plain words and Parley picks one of Common Paper's 11 standard agreements (Mutual NDA, Cloud Service Agreement, DPA, SLA, BAA, AI Addendum, Pilot, Design Partner, Partnership, Professional Services, Software License), fills what it can, and asks only for what's missing, as a short questionnaire.
- **Live document.** Every field the AI sets shows on the page as it arrives, with Undo in the chat. Any field can also be edited by hand. The panel can be resized or closed; on a phone, the chat and the document are two tabs.
- **Start without an account.** Guests can draft right away after a Turnstile check. Signing up or signing in (email and password, Google or GitHub) keeps the draft and the chat.
- **Accounts.** Email confirmation, password reset, email change, two-factor sign-in with an authenticator app and backup codes, and account deletion.
- **Downloads.** PDF for everyone with a confirmed email (3 documents a month on Free); Word files and no monthly limit with Pro.
- **Parley Pro**, $5 a month, through Polar (sandbox: no real payments).
- **Share links.** A read-only link to a draft, which the owner can revoke.
- **Drafts.** History grouped by date, search over titles, agreement types and party names, rename, duplicate, and delete with undo.
- **Dark theme**, keyboard use throughout, and screen-reader labels (Lighthouse accessibility 100 on the public pages).

### Security

- Content Security Policy with nonces, HSTS, `frame-ancestors 'none'` and a strict referrer policy on every response.
- Per-user rate limits on every procedure, the AI, downloads and billing; a limit on new guests per network; daily AI message limits per plan; a cap on what each AI call may write; a hard spending cap on the AI key ([ADR-0012](docs/adr/0012-cost-limits-in-four-layers.md)).
- OAuth tokens encrypted at rest; share tokens and other secrets kept out of the logs.

[1.0.0]: https://github.com/VaelorAshbound/parley/releases/tag/v1.0.0
