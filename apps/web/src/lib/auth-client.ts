import { anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// The browser side of Better Auth, on the same origin (/api/auth).
export const authClient = createAuthClient({
  plugins: [anonymousClient()],
})

/**
 * Starts a guest session. Sign-ins are limited per IP (3 per 10 s), which
 * people behind one office network can hit; wait as told and retry instead
 * of failing.
 */
export async function signInGuest() {
  for (let attempt = 1; ; attempt++) {
    let retryAfter = 0
    const { error } = await authClient.signIn.anonymous({
      fetchOptions: {
        onError: ({ response }) => {
          retryAfter = Number(response.headers.get("X-Retry-After") ?? 0)
        },
      },
    })
    if (!error) return
    if (error.status !== 429 || attempt === 3 || retryAfter > 15)
      throw new Error(error.message ?? "Couldn’t start a session")
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
  }
}
