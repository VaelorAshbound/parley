import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"

import { authConfigQuery } from "@/features/auth/auth-config"
import {
  authErrorMessage,
  verifyLinkErrorMessage,
} from "@/features/auth/messages"
import { authSearch } from "@/features/auth/redirect"
import { useTurnstile } from "@/features/auth/turnstile"
import { authClient } from "@/lib/auth-client"
import { freshViewer, viewerQuery, type Viewer } from "@/lib/session"

// "Check your inbox" after sign-up, and where the link in the email lands
// (spec §5 Auth). Export, share and upgrade wait for this.
export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: authSearch,
  beforeLoad: async ({ context: { viewer, queryClient } }) => {
    if (!viewer || viewer.isAnonymous || viewer.emailVerified) return
    // The link was likely just opened, but the session cookie can say "not
    // confirmed" for 5 more minutes: ask the database (it also refreshes
    // the cookie, so the rest of Parley sees it too).
    const fresh = await freshViewer()
    queryClient.setQueryData(viewerQuery.queryKey, fresh)
    return { viewer: fresh }
  },
  head: () => ({ meta: [{ title: "Confirm your email · Parley" }] }),
  component: VerifyEmail,
})

function VerifyEmail() {
  const { redirect: returnTo = "/", error } = Route.useSearch()
  const { viewer } = Route.useRouteContext()
  const account = viewer && !viewer.isAnonymous ? viewer : undefined

  if (!account)
    return (
      <Page
        title={error ? "Confirm your email" : "Sign in to continue"}
        description={
          error
            ? `${verifyLinkErrorMessage(error)} Sign in to get a new one.`
            : // The link confirms but never signs in (server/auth.ts).
              "If you opened the link in our email, your email is confirmed."
        }
      >
        <Link
          to="/sign-in"
          search={{ redirect: returnTo }}
          className={buttonVariants({ size: "lg" })}
        >
          Sign in
        </Link>
      </Page>
    )

  if (account.emailVerified)
    return (
      <Page
        title="Your email is confirmed"
        description="You can now download and share your drafts."
      >
        <Link to={returnTo} className={buttonVariants({ size: "lg" })}>
          Continue
        </Link>
      </Page>
    )

  return (
    <Page
      title={error ? "Let’s try that again" : "Check your inbox"}
      description={
        error
          ? verifyLinkErrorMessage(error)
          : `We sent a link to ${account.email}. Open it to confirm your email. It works for 1 hour.`
      }
    >
      <Link to={returnTo} className={buttonVariants({ size: "lg" })}>
        Back to your draft
      </Link>
      <ResendLink account={account} returnTo={returnTo} />
    </Page>
  )
}

function Page({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-normal tracking-[-0.02em]">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

/** Sends a fresh link, behind Turnstile (it sends an email). */
function ResendLink({
  account,
  returnTo,
}: {
  account: NonNullable<Viewer>
  returnTo: string
}) {
  const { data: config } = useSuspenseQuery(authConfigQuery)
  const turnstile = useTurnstile(config.turnstileSiteKey)
  const [state, setState] = useState<
    { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" })

  async function resend() {
    setState({ kind: "sending" })
    let headers: Record<string, string>
    try {
      headers = await turnstile.headers()
    } catch {
      setState({
        kind: "error",
        message: authErrorMessage({ code: "MISSING_RESPONSE", status: 400 }),
      })
      return
    }
    const here = `/verify-email?${new URLSearchParams({ redirect: returnTo })}`
    const { error } = await authClient.sendVerificationEmail(
      {
        email: account.email,
        callbackURL: new URL(here, window.location.origin).href,
      },
      { headers }
    )
    setState(
      error
        ? { kind: "error", message: authErrorMessage(error) }
        : { kind: "sent" }
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="lg"
        disabled={state.kind === "sending"}
        onClick={() => void resend()}
      >
        {state.kind === "sending" && <Spinner data-icon="inline-start" />}
        Send a new link
      </Button>
      {turnstile.widget}
      {/* <output> is a polite live region: screen readers hear "Sent". */}
      <output className="text-center text-sm text-muted-foreground">
        {state.kind === "sent" && `Sent. Check your inbox at ${account.email}.`}
      </output>
      {state.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </>
  )
}
