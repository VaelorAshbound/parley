import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import type { CodeKind } from "@/features/account/two-factor/code-field"
import { CodeStep } from "@/features/account/two-factor/code-step"
import { AuthCard, footerLink } from "@/features/auth/auth-card"
import { redirectSearch } from "@/features/auth/redirect"

// The code step of signing in with two-factor on (spec §5 Routing, T23b).
// The sign-in form comes here after a right password.
export const Route = createFileRoute("/_auth/two-factor")({
  validateSearch: redirectSearch,
  beforeLoad: ({ context, search }) => {
    // Already signed in: nothing to do here.
    if (context.viewer && !context.viewer.isAnonymous)
      throw redirect({ href: search.redirect ?? "/", replace: true })
  },
  head: () => ({ meta: [{ title: "Enter your code · Parley" }] }),
  component: TwoFactor,
})

const words: Record<
  CodeKind,
  { title: string; description: string; switchTo: string }
> = {
  app: {
    title: "Enter your code",
    description:
      "Open your authenticator app and enter the 6-digit code for Parley.",
    switchTo: "Use a backup code instead",
  },
  backup: {
    title: "Use a backup code",
    description:
      "Enter one of the backup codes you saved. Each code works once.",
    switchTo: "Use your authenticator app instead",
  },
}

function TwoFactor() {
  const { redirect: returnTo = "/" } = Route.useSearch()
  const [kind, setKind] = useState<CodeKind>("app")

  return (
    <AuthCard
      title={words[kind].title}
      description={words[kind].description}
      footer={
        <Link
          to="/sign-in"
          search={{ redirect: returnTo }}
          className={footerLink}
        >
          Back to sign in
        </Link>
      }
    >
      <CodeStep key={kind} kind={kind} returnTo={returnTo} />
      <Button
        variant="link"
        className="self-center"
        onClick={() => setKind(kind === "app" ? "backup" : "app")}
      >
        {words[kind].switchTo}
      </Button>
    </AuthCard>
  )
}
