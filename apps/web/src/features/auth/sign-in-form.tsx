import { revalidateLogic } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { authErrorMessage, humanCheckFailed } from "./messages"
import { reloadTo } from "./reload-to"
import { useTurnstile } from "./turnstile"

const schema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(1, "Please enter your password."),
})

/**
 * Email + password sign-in. A guest's drafts join the account's own
 * (onLinkAccount), and the user lands back where they were.
 */
export function SignInForm({
  siteKey,
  returnTo,
  lastUsed,
}: {
  siteKey: string
  returnTo: string
  /** Email was the method used last on this device. */
  lastUsed: boolean
}) {
  const turnstile = useTurnstile(siteKey)
  const [error, setError] = useState<string>()

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const headers = await turnstile.headers()
      if (!headers) {
        setError(humanCheckFailed)
        return
      }
      const { error } = await authClient.signIn.email(value, { headers })
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      reloadTo(returnTo)
    },
  })

  return (
    <form
      // If someone submits before the page is interactive, the browser
      // posts the form instead of putting the password in the URL.
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
            <field.TextField label="Email" type="email" autoComplete="email" />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        {/* Also the way back for someone whose address another person
            signed up with and never confirmed (server/auth.ts). */}
        <Link
          to="/forgot-password"
          search={{ redirect: returnTo }}
          className="-mt-3 self-end text-sm font-medium text-blue-ink underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        {turnstile.widget}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              Sign in
              {lastUsed && (
                <Badge variant="secondary" className="ml-auto">
                  Last used
                </Badge>
              )}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
