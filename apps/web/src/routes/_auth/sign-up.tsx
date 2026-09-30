import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"

import { AuthCard, footerLink } from "@/features/auth/auth-card"
import { authConfigQuery } from "@/features/auth/auth-config"
import { authSearch } from "@/features/auth/redirect"
import { SignUpForm } from "@/features/auth/sign-up-form"
import { SocialSignIn } from "@/features/auth/social-buttons"

export const Route = createFileRoute("/_auth/sign-up")({
  validateSearch: authSearch,
  beforeLoad: ({ context, search }) => {
    if (context.viewer && !context.viewer.isAnonymous)
      throw redirect({ href: search.redirect ?? "/", replace: true })
  },
  head: () => ({ meta: [{ title: "Create an account · Parley" }] }),
  component: SignUp,
})

function SignUp() {
  const { redirect: returnTo = "/", error } = Route.useSearch()
  const { viewer } = Route.useRouteContext()
  const { data: config } = useSuspenseQuery(authConfigQuery)

  return (
    <AuthCard
      title="Create your account"
      description={
        viewer?.isAnonymous
          ? "Save your draft and chat, then download and share them."
          : "Save your drafts, then download and share them."
      }
      footer={
        <p>
          Have an account?{" "}
          <Link
            to="/sign-in"
            search={{ redirect: returnTo }}
            className={footerLink}
          >
            Sign in
          </Link>
        </p>
      }
    >
      <SocialSignIn
        providers={config.providers}
        lastUsed={undefined}
        returnTo={returnTo}
        error={error}
      />
      <SignUpForm siteKey={config.turnstileSiteKey} returnTo={returnTo} />
    </AuthCard>
  )
}
