import { revalidateLogic } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { z } from "zod"

import { authConfigQuery } from "@/features/auth/auth-config"
import {
  authErrorMessage,
  emailLinkErrorMessage,
  humanCheckFailed,
} from "@/features/auth/messages"
import { useTurnstile } from "@/features/auth/turnstile"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"
import type { Viewer } from "@/lib/session"

import { idle, SubmitRow, type Status } from "./form-status"

/**
 * Where the links in the change-email emails land: back here, with the new
 * address, so the page can say which step is done (Better Auth keeps this
 * URL through both links, and adds `error=` when one fails).
 */
export function afterEmailLink(newEmail: string) {
  const path = `/settings?${new URLSearchParams({ email: newEmail })}`
  return new URL(path, window.location.origin).href
}

/**
 * The email and whether it is confirmed, and changing it (spec §5 Auth): a
 * confirmed address approves the move first, then the new one confirms.
 */
export function EmailCard({
  account,
  linkEmail,
  linkError,
}: {
  account: NonNullable<Viewer>
  /** `?email=`: a change-email link just brought the user back. */
  linkEmail: string | undefined
  /** `?error=`: that link didn't work. */
  linkError: string | undefined
}) {
  const [status, setStatus] = useState<Status>(idle)
  const { data: config } = useSuspenseQuery(authConfigQuery)
  const turnstile = useTurnstile(config.turnstileSiteKey)

  const schema = z.object({
    email: z
      .email("Please enter a valid email.")
      .refine(
        (email) => email.toLowerCase() !== account.email,
        "That’s your email now."
      ),
  })

  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setStatus(idle)
      const newEmail = value.email.toLowerCase()
      // It sends an email: Turnstile first (spec §5 Auth).
      const headers = await turnstile.headers()
      if (!headers) {
        setStatus({ kind: "error", message: humanCheckFailed })
        return
      }
      const { error } = await authClient.changeEmail(
        { newEmail, callbackURL: afterEmailLink(newEmail) },
        { headers }
      )
      if (error) {
        setStatus({ kind: "error", message: authErrorMessage(error) })
        return
      }
      setStatus({
        kind: "done",
        message: account.emailVerified
          ? `Check ${account.email}: open the link to approve the change.`
          : `Check ${newEmail}: open the link to confirm it.`,
      })
      form.reset()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Email</h2>
        </CardTitle>
        <CardDescription className="flex min-w-0 flex-wrap items-center gap-2">
          {/* A long address shortens instead of leaving the card. */}
          <span className="max-w-full min-w-0 truncate">{account.email}</span>
          {account.emailVerified ? (
            <Badge variant="secondary">Confirmed</Badge>
          ) : (
            <Badge variant="outline">Not confirmed</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LinkNotice account={account} email={linkEmail} error={linkError} />
        <form
          method="post"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  label="New email"
                  type="email"
                  autoComplete="email"
                  help={
                    account.emailVerified
                      ? "We ask your current email to approve, then the new one to confirm."
                      : "We send a link to the new email to confirm it."
                  }
                />
              )}
            </form.AppField>
            {turnstile.widget}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <SubmitRow status={status} submitting={submitting}>
                  Change email
                </SubmitRow>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

/** What the last change-email link did. */
function LinkNotice({
  account,
  email,
  error,
}: {
  account: NonNullable<Viewer>
  email: string | undefined
  error: string | undefined
}) {
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{emailLinkErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  if (!email) {
    if (account.emailVerified) return null
    return (
      <Alert>
        <AlertDescription>
          Confirm your email to download and share your drafts.{" "}
          <Link
            to="/verify-email"
            search={{ redirect: "/settings" }}
            className="font-medium underline underline-offset-4"
          >
            Get a new link
          </Link>
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertDescription>
        {email === account.email
          ? `Your email is now ${email}.`
          : `Approved. Now open the link we sent to ${email}.`}
      </AlertDescription>
    </Alert>
  )
}
