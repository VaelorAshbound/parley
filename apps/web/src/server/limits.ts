import type { Ratelimiter } from "@orpc/experimental-ratelimit"
import { CloudflareRatelimiter } from "@orpc/experimental-ratelimit/cloudflare-ratelimit"
import { Temporal } from "temporal-polyfill"

// Who may do how much (spec §2 Limits, T27). The first values; change them
// here. Each limit guards something that costs money or can be abused.

/**
 * The Rate Limiting bindings, per user: `limit` calls every `period`
 * seconds. The numbers live in wrangler.jsonc (top level and `previews`);
 * this copy is for the tests and messages, and a test keeps the two equal.
 */
export const RATE_LIMITS = {
  /** Every procedure: far above what a person clicks. */
  RPC_RATE_LIMITER: { limit: 300, period: 60 },
  /** The AI routes (chat.send, chat.answer): each is a model call. */
  AI_RATE_LIMITER: { limit: 10, period: 10 },
  /** Downloads: each PDF is a ~4 s Browser Run print, re-exports too. */
  EXPORT_RATE_LIMITER: { limit: 10, period: 60 },
} as const

type Binding = keyof typeof RATE_LIMITS

/** The per-user limiters, on the procedures' context. */
export type Limiters = {
  rpc: Ratelimiter
  ai: Ratelimiter
  export: Ratelimiter
}

export function limitersFrom(env: Pick<Env, Binding>): Limiters {
  return {
    rpc: new CloudflareRatelimiter(env.RPC_RATE_LIMITER),
    ai: new CloudflareRatelimiter(env.AI_RATE_LIMITER),
    export: new CloudflareRatelimiter(env.EXPORT_RATE_LIMITER),
  }
}

/** AI messages a day, counted per UTC day in `ai_usage` (shared with the UI). */
export { DAILY_MESSAGES, type LimitTier } from "../lib/limits"

/** The UTC day the daily limits count in, and when the next one starts. */
export function usageDay(now: Temporal.Instant = Temporal.Now.instant()) {
  const day = now.toZonedDateTimeISO("UTC").toPlainDate()
  const next = day.add({ days: 1 }).toZonedDateTime("UTC").toInstant()
  return {
    day: day.toString(),
    resetsAt: new Date(next.epochMilliseconds).toISOString(),
  }
}

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
 * The same on Previews. They pass every Turnstile token (test keys) and
 * anyone can guess their URL, so they let only a few new guests in at a time.
 * The e2e fixture waits and tries again on 429 (e2e/helpers.ts).
 */
export const PREVIEW_GUESTS_PER_NETWORK = { window: 10, max: 5 }

/**
 * Local dev and the Worker tests: also Turnstile's test keys, and the e2e
 * runs make a guest per test from one address. Still a limit.
 */
export const TEST_GUESTS_PER_NETWORK = { window: 10, max: 30 }
