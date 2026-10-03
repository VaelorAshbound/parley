# ADR-0013: Two-factor sign-in through Better Auth's twoFactor plugin, with a reused code as an accepted risk

## Status

Accepted (built in T23b; hardened in PAR-20, 2026-10-03)

## Context

Accounts with a password can turn on two-factor sign-in: a code from an authenticator app (TOTP), or one of 10 single-use backup codes (spec §5 Auth). Google and GitHub sign-ins have their own second step and are not gated.

The Checkpoint 6 review (PAR-20) found gaps around the plugin's defaults: devices trusted to skip the code outlived a password reset, turning two-factor on left other devices signed in, a guest carried to the code step could end up in the wrong account, and a code can be used again within its window.

## Decision

- **Better Auth's `twoFactor` plugin**, not our own TOTP code (`src/server/two-factor.ts`). Secrets and backup codes are encrypted with the auth secret; codes are compared in constant time; each two-factor step allows 3 tries per 10 s per network, and 10 wrong codes lock the account's code step for 15 minutes.
- **Trusted devices ("Trust this device for 30 days") are forgotten** when two-factor is turned off, when the password is reset, and when a password change signs the other devices out. Whoever knew the old password may have trusted their own device.
- **Turning two-factor on offers "Sign out other devices"** on the backup codes step: a button, not a checkbox (owner's call, 2026-10-03). This device stays signed in.
- **The carried guest** (ADR-0011) lives in a signed 10-minute cookie that any other new session expires, and that a password step with no guest of its own clears. The next person to sign in on a shared computer never gets the earlier guest's drafts.
- **A code can be used again within its window: accepted risk.** Better Auth accepts the code of the current 30-second period and the one before and after, and has no option to refuse a code already used (1.7.5). So one code works for up to about 90 seconds, more than once.

## Alternatives considered

### Refuse a used code ourselves

- Pros: Closes the replay window (RFC 6238 §5.2 recommends it).
- Cons: An after hook can't stop the plugin from creating the session; a before hook would have to compute the code's period and keep a row per user and period, duplicating the plugin's verification next to it. More auth code of our own is more risk, not less.
- Rejected for now: the replay needs the password (or the 10-minute challenge cookie) **and** a code seen in the last ~90 seconds, for example over the user's shoulder or from a phishing page that relays both, which a single-use check would not stop either.

### Our own TOTP implementation

- Rejected: the plugin already does the encryption, lockout, backup codes and trusted devices, and is maintained upstream.

## Consequences

- A Worker test (`apps/web-worker-tests/test/two-factor.test.ts`, "takes the same app code twice in its window") pins the accepted risk. When Better Auth adds a used-code check, that test fails: turn the check on and update this ADR.
- The rate limit message says "wait 10 seconds", matching the plugin's 3 per 10 s (`src/features/auth/messages.ts`).
- Trusted devices are kept by the plugin as `trust-device-…` rows in `verification`; `forgetTrustedDevices` (`packages/db/src/queries/accounts.ts`) deletes them by user.
