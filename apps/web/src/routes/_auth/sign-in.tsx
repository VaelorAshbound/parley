import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FieldSeparator } from "@workspace/ui/components/field"
import { useState } from "react"

import { authConfigQuery } from "@/features/auth/auth-config"
import { oauthErrorMessage } from "@/features/auth/messages"
import { authSearch } from "@/features/auth/redirect"
import { SignInForm } from "@/features/auth/sign-in-form"
import { SocialButtons } from "@/features/auth/social-buttons"
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
  const [socialError, setSocialError] = useState(
    error ? oauthErrorMessage(error) : undefined
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-normal tracking-[-0.02em]">
          <h1>Sign in to Parley</h1>
        </CardTitle>
        <CardDescription>
          {viewer?.isAnonymous
            ? "Your draft and chat come with you."
            : "Your drafts are waiting."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {socialError && (
          <Alert variant="destructive">
            <AlertDescription>{socialError}</AlertDescription>
          </Alert>
        )}
        {config.providers.length > 0 && (
          <>
            <SocialButtons
              providers={config.providers}
              lastUsed={lastUsed}
              returnTo={returnTo}
              onError={setSocialError}
            />
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
              or with email
            </FieldSeparator>
          </>
        )}
        <SignInForm
          siteKey={config.turnstileSiteKey}
          returnTo={returnTo}
          lastUsed={lastUsed === "email"}
        />
      </CardContent>
      <CardFooter className="justify-center border-t text-sm text-muted-foreground">
        <p>
          New to Parley?{" "}
          <Link
            to="/sign-up"
            search={{ redirect: returnTo }}
            className="font-medium text-blue-ink underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
