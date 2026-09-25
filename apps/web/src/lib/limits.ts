// Limits the browser shows too (spec §2 Limits). The server enforces them
// (src/server/limits.ts).

/**
 * AI messages a day: each message or set of answers to the AI's questions
 * is one, since each is a model reply. T26 gives Pro users "pro".
 */
export const DAILY_MESSAGES = { guest: 20, free: 100, pro: 500 } as const
export type LimitTier = keyof typeof DAILY_MESSAGES
