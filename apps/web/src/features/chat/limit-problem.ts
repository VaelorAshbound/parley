import { isDefinedError, ORPCError, type InferClientErrors } from "@orpc/client"
import type { RouterClient } from "@orpc/server"

import { DAILY_MESSAGES } from "@/lib/limits"
import type { Router } from "@/server/rpc/router"

// What to tell someone the chat refused for a limit (spec §2 Limits), from
// the typed error, with the way past it. Null for anything else: the chat's
// usual "couldn't answer" covers that.

export type LimitProblem = {
  message: string
  action?: { label: string; href: string }
  /** Trying again soon can work (a burst), unlike the day's limit. */
  retry: boolean
}

/**
 * The chat's typed errors, from the router, so the data read here can't
 * drift from the server's schema (chat.answer's are the same).
 */
type ChatError = InferClientErrors<RouterClient<Router>>["chat"]["send"]

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
  if (!(error instanceof ORPCError)) return null
  const chatError = error as ChatError
  if (!isDefinedError(chatError)) return null
  if (chatError.code === "TOO_MANY_REQUESTS")
    return {
      message:
        "You’re sending messages quickly. Wait a few seconds, then try again.",
      retry: true,
    }
  if (chatError.code !== "DAILY_LIMIT") return null
  const { limit, tier, resetsAt } = chatError.data
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
