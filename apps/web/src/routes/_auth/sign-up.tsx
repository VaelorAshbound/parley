import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

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
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-normal tracking-[-0.02em]">
          <h1>Create your account</h1>
        </CardTitle>
        <CardDescription>
          {viewer?.isAnonymous
            ? "Save your draft and chat, then download and share them."
            : "Save your drafts, then download and share them."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SocialSignIn
          providers={config.providers}
          lastUsed={undefined}
          returnTo={returnTo}
          error={error}
        />
        <SignUpForm siteKey={config.turnstileSiteKey} returnTo={returnTo} />
      </CardContent>
      <CardFooter className="justify-center border-t text-sm text-muted-foreground">
        <p>
          Have an account?{" "}
          <Link
            to="/sign-in"
            search={{ redirect: returnTo }}
            className="font-medium text-blue-ink underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
