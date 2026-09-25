import type { InferRouterOutputs } from "@orpc/server"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"

import { authClient } from "@/lib/auth-client"
import type { Router } from "@/server/rpc/router"

/** How the user signs in: account.get's answer. */
export type Login = InferRouterOutputs<Router>["account"]["get"]

type Provider = Login["providers"][number]
const names: Record<Provider, string> = { google: "Google", github: "GitHub" }

/**
 * Adding a password or deleting an account that has none needs a sign-in
 * in the last 15 minutes (server/auth.ts freshAge). This signs in again
 * with Google or GitHub and comes back here.
 */
export function ConfirmIdentity({ providers }: { providers: Provider[] }) {
  const [leaving, setLeaving] = useState<Provider>()
  const [failed, setFailed] = useState(false)

  async function confirmWith(provider: Provider) {
    setLeaving(provider)
    setFailed(false)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: window.location.href,
      errorCallbackURL: window.location.href,
    })
    // On success the page is already leaving; only errors land here.
    if (error) {
      setLeaving(undefined)
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        For your safety, confirm it’s you first.
      </p>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            disabled={leaving !== undefined}
            onClick={() => void confirmWith(provider)}
          >
            {leaving === provider && <Spinner data-icon="inline-start" />}
            Continue with {names[provider]}
          </Button>
        ))}
      </div>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>
            That didn’t work. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** Whether the session is a recent sign-in, at the moment of asking. */
export function isFresh(freshUntil: Date) {
  return Date.now() < freshUntil.getTime()
}
