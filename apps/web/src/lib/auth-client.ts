import { anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// The browser side of Better Auth, on the same origin (/api/auth).
export const authClient = createAuthClient({
  plugins: [anonymousClient()],
})

/** Why a guest session couldn't start, for the words on the page. */
export class GuestSignInError extends Error {
  constructor(
    readonly reason:
      | "human-check" // Turnstile failed in the browser or on the server
      | "busy" // too many new guests from this network (spec §2 Limits)
      | "failed"
  ) {
    super(`Couldn’t start a guest session (${reason})`)
    this.name = "GuestSignInError"
  }
}

/**
 * Starts a guest session. The server wants a solved Turnstile check
 * (`captcha` gives the headers for one request, or undefined when the
 * check failed). Sign-ins are limited per network; a short wait is waited
 * out and retried with a new check, a long one is reported as "busy".
 */
export async function signInGuest(
  captcha: () => Promise<Record<string, string> | undefined>
) {
  for (let attempt = 1; ; attempt++) {
    const headers = await captcha()
    if (!headers) throw new GuestSignInError("human-check")
    let retryAfter = 0
    const { error } = await authClient.signIn.anonymous({
      fetchOptions: {
        headers,
        onError: ({ response }) => {
          retryAfter = Number(response.headers.get("X-Retry-After") ?? 0)
        },
      },
    })
    if (!error) return
    if (
      error.code === "MISSING_RESPONSE" ||
      error.code === "VERIFICATION_FAILED"
    )
      throw new GuestSignInError("human-check")
    if (error.status !== 429) throw new GuestSignInError("failed")
    if (attempt === 3 || retryAfter > 15) throw new GuestSignInError("busy")
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
  }
}
