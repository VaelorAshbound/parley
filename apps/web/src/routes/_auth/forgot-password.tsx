import { revalidateLogic } from "@tanstack/react-form"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { authConfigQuery } from "@/features/auth/auth-config"
import { authErrorMessage, humanCheckFailed } from "@/features/auth/messages"
import { redirectSearch } from "@/features/auth/redirect"
import { useTurnstile } from "@/features/auth/turnstile"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

// "Forgot password?" (spec §5 Auth): a link to the inbox, which works once
// for 30 minutes. The same answer whether or not the address has an
// account, so the page can't be used to find out who uses Parley.
export const Route = createFileRoute("/_auth/forgot-password")({
  validateSearch: redirectSearch,
  head: () => ({ meta: [{ title: "Reset your password · Parley" }] }),
  component: ForgotPassword,
})

const schema = z.object({ email: z.email("Please enter a valid email.") })

function ForgotPassword() {
  const { redirect: returnTo = "/" } = Route.useSearch()
  const { data: config } = useSuspenseQuery(authConfigQuery)
  const turnstile = useTurnstile(config.turnstileSiteKey)
  const [error, setError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()

  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      // It sends an email: Turnstile first (spec §5 Auth).
      const headers = await turnstile.headers()
      if (!headers) {
        setError(humanCheckFailed)
        return
      }
      const { error } = await authClient.requestPasswordReset(
        { email: value.email },
        { headers }
      )
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      setSentTo(value.email)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-normal tracking-[-0.02em]">
          <h1>{sentTo ? "Check your inbox" : "Reset your password"}</h1>
        </CardTitle>
        <CardDescription>
          {sentTo
            ? `If ${sentTo} has a Parley account, we sent it a link. It works once, for 30 minutes.`
            : "We’ll email you a link to choose a new one."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setSentTo(undefined)}
          >
            Use another email
          </Button>
        ) : (
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
                    label="Email"
                    type="email"
                    autoComplete="email"
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
                    Email me a link
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t text-sm text-muted-foreground">
        <p>
          Remembered it?{" "}
          <Link
            to="/sign-in"
            search={{ redirect: returnTo }}
            className="font-medium text-blue-ink underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
