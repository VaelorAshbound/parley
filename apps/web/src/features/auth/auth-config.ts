import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

/** The sign-in methods this deployment has, for the auth pages. */
export type AuthConfig = {
  /** Turnstile's public site key (a test key in dev and on Previews). */
  turnstileSiteKey: string
  /** OAuth apps set up here. Previews have none (spec §5 Auth). */
  providers: ("google" | "github")[]
}

// Read on the server: the site key and the OAuth apps differ between
// production, Previews and local dev, and are runtime vars, not build ones.
const getAuthConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthConfig> => {
    const { env } = await import("cloudflare:workers")
    const providers: AuthConfig["providers"] = []
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
      providers.push("google")
    if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
      providers.push("github")
    return { turnstileSiteKey: env.TURNSTILE_SITE_KEY, providers }
  }
)

export const authConfigQuery = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => getAuthConfig(),
  // Fixed for the life of a deployment.
  staleTime: Number.POSITIVE_INFINITY,
})
