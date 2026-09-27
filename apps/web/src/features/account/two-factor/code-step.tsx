import { revalidateLogic } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { authErrorMessage, needsNewSignIn } from "@/features/auth/messages"
import { reloadTo } from "@/features/auth/reload-to"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { CodeField, codeFor, codeLength, type CodeKind } from "./code-field"

// The second step of signing in with two-factor on (T23b): the code from
// the authenticator app, or a backup code. The password step left a
// 10-minute challenge cookie; a right code turns it into a session.

const words: Record<CodeKind, { label: string; incomplete: string }> = {
  app: {
    label: "6-digit code",
    incomplete: "Enter all 6 digits.",
  },
  backup: {
    label: "Backup code",
    incomplete: "Enter all 10 characters.",
  },
}

export function CodeStep({
  kind,
  returnTo,
}: {
  kind: CodeKind
  returnTo: string
}) {
  const [error, setError] = useState<{ message: string; restart: boolean }>()

  const form = useAppForm({
    defaultValues: { code: "", trust: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        code: z.string().length(codeLength(kind), words[kind].incomplete),
        trust: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const body = {
        code: codeFor(kind, value.code),
        trustDevice: value.trust === "on",
      }
      const { error } =
        kind === "app"
          ? await authClient.twoFactor.verifyTotp(body)
          : await authClient.twoFactor.verifyBackupCode(body)
      if (error) {
        setError({
          message: authErrorMessage(error),
          restart: needsNewSignIn(error.code),
        })
        return
      }
      reloadTo(returnTo)
    },
  })

  /** Sends the code as soon as the last box is filled. */
  function sendWhenFull() {
    if (!form.state.isSubmitting) void form.handleSubmit()
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.AppField name="code">
          {() => (
            <CodeField
              kind={kind}
              label={words[kind].label}
              onComplete={sendWhenFull}
              // The page has nothing else to fill in.
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="trust">
          {(field) => (
            <field.CheckField label="Trust this device for 30 days" />
          )}
        </form.AppField>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message}{" "}
              {error.restart && (
                <Link
                  to="/sign-in"
                  search={{ redirect: returnTo }}
                  className="underline"
                >
                  Sign in
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              Verify
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
