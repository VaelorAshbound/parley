import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FieldSeparator } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"

import { authClient } from "@/lib/auth-client"

import type { AuthConfig } from "./auth-config"
import { oauthErrorMessage } from "./messages"

type Provider = AuthConfig["providers"][number]

const names: Record<Provider, string> = { google: "Google", github: "GitHub" }

/**
 * The top of the sign-in and sign-up pages: the Google and GitHub buttons
 * (where set up), and what went wrong if one of them sent the user back
 * with `?error=`.
 */
export function SocialSignIn({
  providers,
  lastUsed,
  returnTo,
  error,
}: {
  providers: Provider[]
  lastUsed: string | undefined
  returnTo: string
  /** The `?error=` code the page was opened with. */
  error: string | undefined
}) {
  const [message, setMessage] = useState(
    error ? oauthErrorMessage(error) : undefined
  )

  return (
    <>
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {providers.length > 0 && (
        <>
          <SocialButtons
            providers={providers}
            lastUsed={lastUsed}
            returnTo={returnTo}
            onError={setMessage}
          />
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            or with email
          </FieldSeparator>
        </>
      )}
    </>
  )
}

/**
 * "Continue with Google / GitHub". The browser leaves for the provider and
 * comes back to `returnTo`; a guest's drafts move to the account on the way
 * (onLinkAccount). The method used last gets a "Last used" badge.
 */
function SocialButtons({
  providers,
  lastUsed,
  returnTo,
  onError,
}: {
  providers: Provider[]
  lastUsed: string | undefined
  /** Where to land afterwards: a path on Parley. */
  returnTo: string
  onError: (message: string) => void
}) {
  const [leaving, setLeaving] = useState<Provider>()

  async function continueWith(provider: Provider) {
    setLeaving(provider)
    const here = new URL(window.location.href)
    const { error } = await authClient.signIn.social({
      provider,
      // Absolute, so Better Auth needn't guess the origin.
      callbackURL: new URL(returnTo, here.origin).href,
      // Back to this page, which explains ?error=.
      errorCallbackURL: here.href,
    })
    // On success the page is already leaving; only errors land here.
    if (error) {
      setLeaving(undefined)
      onError("Signing in didn’t work. Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="outline"
          size="lg"
          disabled={leaving !== undefined}
          onClick={() => void continueWith(provider)}
        >
          {leaving === provider ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ProviderIcon provider={provider} />
          )}
          Continue with {names[provider]}
          {lastUsed === provider && (
            <Badge variant="secondary" className="ml-auto">
              Last used
            </Badge>
          )}
        </Button>
      ))}
    </div>
  )
}

/** The providers' own marks (their brand rules ask for these, unchanged). */
function ProviderIcon({ provider }: { provider: Provider }) {
  return provider === "google" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icon="inline-start"
      fill="currentColor"
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}
