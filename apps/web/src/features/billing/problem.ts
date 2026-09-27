import type { AuthError } from "@/features/auth/messages"

// What to tell someone whose checkout or billing portal didn't open (T26),
// from the codes server/billing.ts and Better Auth answer with. Each comes
// with the way past it.

export type BillingProblem = {
  message: string
  action?: { label: string; href: string }
}

/** Where every way past a problem comes back to. */
const back = encodeURIComponent("/pricing")

export function billingProblem(error: AuthError): BillingProblem {
  if (error.status === 429)
    return { message: "Too many tries. Please wait a minute, then try again." }
  switch (error.code) {
    case "UNAUTHORIZED":
      return {
        message: "Sign in to upgrade.",
        action: { label: "Sign in", href: `/sign-in?redirect=${back}` },
      }
    case "EMAIL_NOT_VERIFIED":
      return {
        message: "Confirm your email first, then upgrade. We sent you a link.",
        action: {
          label: "Get a new link",
          href: `/verify-email?redirect=${back}`,
        },
      }
    case "ALREADY_PRO":
      return { message: "You already have Pro." }
    // Polar's API failed, or (a bug) the checkout asked for something else.
    default:
      return {
        message: "Polar, our payment service, didn’t answer. Please try again.",
      }
  }
}
