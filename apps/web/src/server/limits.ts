// Who may do how much (spec §2 Limits, T27). The first values; change them
// here. Each limit guards something that costs money or can be abused.

/**
 * Drafts a guest may keep (spec §2 Limits). An account has no limit; signing
 * up keeps the guest's draft.
 */
export const GUEST_DRAFTS = 1

/**
 * New guests from one network (IP address), in production: at most `max`,
 * then none until an hour after the last one (Better Auth's rate limiter,
 * `window` in seconds). Each guest also solved a Turnstile check and gets its
 * own daily messages, so this stops a farm of guests from one machine.
 */
export const GUESTS_PER_NETWORK = { window: 60 * 60, max: 10 }

/**
 * The same on test deployments (local dev, the Worker tests, Previews):
 * Turnstile's test keys let everyone through there, and the e2e runs make a
 * guest per test from one address. Still a limit, so a Preview can't be
 * flooded.
 */
export const TEST_GUESTS_PER_NETWORK = { window: 10, max: 30 }
