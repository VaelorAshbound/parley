import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { CheckIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { authErrorMessage } from "@/features/auth/messages"
import { authClient } from "@/lib/auth-client"

/**
 * "Sign out other devices" on the backup codes step (PAR-20, owner's call
 * 2026-10-03: a button, not a checkbox). Turning two-factor on leaves the
 * devices already signed in as they are; someone who turns it on because
 * of a leak can end them here. This device stays signed in. A signed-out
 * device keeps its session for up to 5 minutes (the cookie cache in
 * server/auth.ts), as on the sessions card, so the result says "within".
 */
export function SignOutOthers() {
  const [state, setState] = useState<
    { kind: "idle" | "sending" | "done" } | { kind: "error"; message: string }
  >({ kind: "idle" })
  const result = useRef<HTMLOutputElement>(null)

  // The focused button goes away when it's done: keep keyboard and
  // screen reader users on the result, not the top of the dialog.
  useEffect(() => {
    if (state.kind === "done") result.current?.focus()
  }, [state.kind])

  async function signOutOthers() {
    setState({ kind: "sending" })
    const { error } = await authClient.revokeOtherSessions()
    setState(
      error
        ? { kind: "error", message: authErrorMessage(error) }
        : { kind: "done" }
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      {/* An <output> is a polite live region (role "status"). */}
      <output
        ref={result}
        tabIndex={-1}
        className="text-sm text-muted-foreground outline-none"
      >
        {state.kind === "done" ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <CheckIcon aria-hidden className="size-4" />
            Other devices will be signed out within 5 minutes.
          </span>
        ) : state.kind === "error" ? (
          <span className="text-destructive">{state.message}</span>
        ) : (
          "Your other devices stay signed in."
        )}
      </output>
      {state.kind !== "done" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={state.kind === "sending"}
          onClick={() => void signOutOthers()}
        >
          {state.kind === "sending" && <Spinner data-icon="inline-start" />}
          Sign out other devices
        </Button>
      )}
    </div>
  )
}
