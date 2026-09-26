---
id: PAR-11
title: "Turnstile: reset the live widget after each send, so a second send gets a new token"
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-25T19:12:13Z
updated: 2026-09-25T19:12:13Z
---

Found by T23's fix agent. useTurnstile().headers() in apps/web/src/features/auth/turnstile.tsx reads ref.current once, before it waits. If a form is sent before the Turnstile script loads, it keeps the old handle, and its reset() does nothing ("Turnstile has not been loaded"). A second send then reuses the spent token and fails. Fix: call ref.current?.reset() in finally. Affects sign-in, sign-up, forgot-password, verify-email and the Email card. Needs a failing test first.
