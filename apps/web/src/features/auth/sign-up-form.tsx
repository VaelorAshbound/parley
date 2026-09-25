import { revalidateLogic } from "@tanstack/react-form"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { authErrorMessage } from "./messages"
import { reloadTo } from "./reload-to"
import { useTurnstile } from "./turnstile"

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.email("Please enter a valid email."),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Use at most 128 characters."),
})

/**
 * Email + password sign-up. The account is signed in at once, so a guest's
 * draft moves over right away; a link to confirm the email goes out in the
 * background (spec §5 Auth).
 */
export function SignUpForm({
  siteKey,
  returnTo,
}: {
  siteKey: string
  returnTo: string
}) {
  const turnstile = useTurnstile(siteKey)
  const [error, setError] = useState<string>()

  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      let headers: Record<string, string>
      try {
        headers = await turnstile.headers()
      } catch {
        setError(authErrorMessage({ code: "MISSING_RESPONSE", status: 400 }))
        return
      }
      const verifyEmail = `/verify-email?${new URLSearchParams({ redirect: returnTo })}`
      const { error } = await authClient.signUp.email(
        {
          name: value.name.trim(),
          email: value.email,
          password: value.password,
          // Where the link in the email lands.
          callbackURL: new URL(verifyEmail, window.location.origin).href,
        },
        { headers }
      )
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      reloadTo(verifyEmail)
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
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" autoComplete="name" />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.TextField label="Email" type="email" autoComplete="email" />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Password"
              help="At least 10 characters."
              autoComplete="new-password"
            />
          )}
        </form.AppField>
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
              Create account
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
