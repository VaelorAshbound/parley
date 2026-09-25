import { ORPCError } from "@orpc/client"

import { humanCheckFailed } from "@/features/auth/messages"
import { GuestSignInError } from "@/lib/auth-client"

// What to tell someone whose new draft didn't start (the home page), with
// the way past it. Typed errors only, never message text (spec §5 API).

export type StartProblem = {
  message: string
  action?: { label: string; href: string }
}

const SIGN_UP = { label: "Create an account", href: "/sign-up" }

export function startProblem(error: unknown): StartProblem {
  if (error instanceof GuestSignInError) {
    if (error.reason === "human-check") return { message: humanCheckFailed }
    if (error.reason === "busy")
      return {
        message:
          "Many people started as guests from your network just now. Create a free account to start, or try again in an hour.",
        action: SIGN_UP,
      }
  }
  if (
    error instanceof ORPCError &&
    error.defined &&
    error.code === "DRAFT_LIMIT"
  )
    return {
      message:
        "Guests keep one draft. Create a free account to start another. Your draft comes with you.",
      action: SIGN_UP,
    }
  return { message: "We couldn’t start that draft. Please try again." }
}
