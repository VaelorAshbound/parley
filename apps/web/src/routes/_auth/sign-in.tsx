import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"

import { AuthCard, footerLink } from "@/features/auth/auth-card"
import { authConfigQuery } from "@/features/auth/auth-config"
import { authSearch } from "@/features/auth/redirect"
import { SignInForm } from "@/features/auth/sign-in-form"
import { SocialSignIn } from "@/features/auth/social-buttons"
import { readCookie } from "@/lib/cookies"

/** Set by Better Auth's lastLoginMethod plugin (readable by the page). */
const lastUsedCookie = "better-auth.last_used_login_method"

export const Route = createFileRoute("/_auth/sign-in")({
  validateSearch: authSearch,
  beforeLoad: ({ context, search }) => {
    // Already signed in: nothing to do here.
    if (context.viewer && !context.viewer.isAnonymous)
      throw redirect({ href: search.redirect ?? "/", replace: true })
  },
  loader: () => ({ lastUsed: readCookie(lastUsedCookie) }),
  head: () => ({ meta: [{ title: "Sign in · Parley" }] }),
  component: SignIn,
})

function SignIn() {
  const { redirect: returnTo = "/", error } = Route.useSearch()
  const { viewer } = Route.useRouteContext()
  const { lastUsed } = Route.useLoaderData()
  const { data: config } = useSuspenseQuery(authConfigQuery)

  return (
    <AuthCard
      title="Sign in to Parley"
      description={
        viewer?.isAnonymous
          ? "Your draft and chat come with you."
          : "Your drafts are waiting."
      }
      footer={
        <p>
          New to Parley?{" "}
          <Link
            to="/sign-up"
            search={{ redirect: returnTo }}
            className={footerLink}
          >
            Create an account
          </Link>
        </p>
      }
    >
      <SocialSignIn
        providers={config.providers}
        lastUsed={lastUsed}
        returnTo={returnTo}
        error={error}
      />
      <SignInForm
        siteKey={config.turnstileSiteKey}
        returnTo={returnTo}
        lastUsed={lastUsed === "email"}
      />
    </AuthCard>
  )
}
