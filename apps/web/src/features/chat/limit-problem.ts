import { ORPCError } from "@orpc/client"

import { DAILY_MESSAGES, type LimitTier } from "@/lib/limits"

// What to tell someone the chat refused for a limit (spec §2 Limits), from
// the typed error, with the way past it. Null for anything else: the chat's
// usual "couldn't answer" covers that.

export type LimitProblem = {
  message: string
  action?: { label: string; href: string }
  /** Trying again soon can work (a burst), unlike the day's limit. */
  retry: boolean
}

type DailyLimit = { limit: number; tier: LimitTier; resetsAt: string }

/** The upgrade page (T26). */
const PRICING = "/pricing"

/**
 * `draftPath` is where a new account brings a guest back. `time` sets how
 * the next day's start is shown; the user's own zone and language by
 * default.
 */
export function limitProblem(
  error: unknown,
  draftPath: string,
  time: { timeZone?: string; locale?: string } = {}
): LimitProblem | null {
  if (!(error instanceof ORPCError) || !error.defined) return null
  if (error.code === "TOO_MANY_REQUESTS")
    return {
      message:
        "You’re sending messages quickly. Wait a few seconds, then try again.",
      retry: true,
    }
  if (error.code !== "DAILY_LIMIT") return null
  const { limit, tier, resetsAt } = error.data as DailyLimit
  const used = `You’ve used today’s ${limit} messages.`
  if (tier === "guest")
    return {
      message: `${used} Create a free account for ${DAILY_MESSAGES.free} a day. Your draft comes with you.`,
      action: {
        label: "Create an account",
        href: `/sign-up?redirect=${encodeURIComponent(draftPath)}`,
      },
      retry: false,
    }
  const back = new Intl.DateTimeFormat(time.locale, {
    timeStyle: "short",
    timeZone: time.timeZone,
  }).format(new Date(resetsAt))
  if (tier === "free")
    return {
      message: `${used} More come at ${back}, or get ${DAILY_MESSAGES.pro} a day with Pro.`,
      action: { label: "Get Pro", href: PRICING },
      retry: false,
    }
  return { message: `${used} More come at ${back}.`, retry: false }
}
