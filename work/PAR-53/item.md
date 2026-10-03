---
id: PAR-53
title: >-
  Security follow-ups from the /ship review (dev dependency CVEs, sign-up
  enumeration note, list-sessions, Neon branch protection)
phase: backlog
priority: low
origin: PAR-1
created: 2026-10-01T20:06:58Z
updated: 2026-10-01T20:06:58Z
---

From T40's security audit and checks (work/PAR-1/ship.md):
- pnpm overrides: undici >=7.29.1 (miniflare), tmp >=0.2.6, esbuild via @esbuild-kit; update @lhci/cli. None are in the Worker bundle.
- Sign-up answers USER_ALREADY_EXISTS for a known email (Better Auth without requireEmailVerification). Turnstile slows it. Record the trade-off in an ADR line (session at sign-up for guest linking).
- Add /list-sessions to disabledPaths (account.sessions replaces it; it returns session tokens).
- Protect the Neon production branch.
- Optional: Cloudflare Access in front of old versions' workers.dev URLs.
