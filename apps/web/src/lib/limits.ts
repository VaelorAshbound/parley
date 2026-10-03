// Limits the browser shows too (spec §2 Limits). The server enforces them
// (src/server/limits.ts).

/**
 * AI messages a day: each message or set of answers to the AI's questions
 * is one, since each is a model reply. T26 gives Pro users "pro".
 */
export const DAILY_MESSAGES = { guest: 20, free: 100, pro: 500 } as const
export type LimitTier = keyof typeof DAILY_MESSAGES

/**
 * The longest message a user may send, in characters once trimmed. The
 * server refuses longer ones (server/ai/chat.ts); the reply box says so.
 */
export const MAX_MESSAGE = 4000

/**
 * How long a chat turn may still be running after it began. A page waits
 * this long for a reply it didn't see start (use-unfinished-turn.ts), and
 * the server refuses a retry of a turn this young that hasn't ended
 * (server/ai/chat.ts, PAR-7): both sides agree on when Try again is real.
 */
export const TURN_LIFETIME_MS = 60_000

/**
 * Drafts a guest may keep (spec §2 Limits). An account has no limit; signing
 * up keeps the guest's draft.
 */
export const GUEST_DRAFTS = 1

/** Documents a Free account may download each calendar month (UTC). */
export const FREE_DOCUMENTS_PER_MONTH = 3

export type Plan = "free" | "pro"

/**
 * The user's plan: Polar's webhooks keep it on the user row (T26,
 * server/billing.ts), so the session carries it.
 */
export function planOf(user: { plan?: string | null }): Plan {
  return user.plan === "pro" ? "pro" : "free"
}
