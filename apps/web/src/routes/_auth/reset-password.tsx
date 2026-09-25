import { revalidateLogic } from "@tanstack/react-form"
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
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { authErrorMessage } from "@/features/auth/messages"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

// Where the reset email's link lands (spec §5 Routing): the token is in the
// query, never the path (ADR-0005). Setting the password signs every device
// out, this one too, so the next step is signing in with it.
export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: z.object({
    token: z.string().max(200).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Choose a new password · Parley" }] }),
  component: ResetPassword,
})

const schema = z.object({
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128, "Use at most 128 characters."),
})

function ResetPassword() {
  const { token } = Route.useSearch()
  const [done, setDone] = useState(false)

  if (!token)
    return (
      <Page
        title="This link is incomplete"
        description="Open the link from the email again, or ask for a new one."
      >
        <Link to="/forgot-password" className={buttonVariants({ size: "lg" })}>
          Ask for a new link
        </Link>
      </Page>
    )

  if (done)
    return (
      <Page
        title="Your password is changed"
        description="For your safety, you’re signed out on every device. Sign in with your new password."
      >
        {/* A full load: this browser's session just ended too. */}
        <Link
          to="/sign-in"
          reloadDocument
          className={buttonVariants({ size: "lg" })}
        >
          Sign in
        </Link>
      </Page>
    )

  return (
    <Page
      title="Choose a new password"
      description="At least 10 characters. This signs you out on every device."
    >
      <NewPasswordForm token={token} onDone={() => setDone(true)} />
    </Page>
  )
}

function NewPasswordForm({
  token,
  onDone,
}: {
  token: string
  onDone: () => void
}) {
  const [error, setError] = useState<{ message: string; expired: boolean }>()

  const form = useAppForm({
    defaultValues: { password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      })
      if (error) {
        setError({
          message: authErrorMessage(error),
          expired: error.code === "INVALID_TOKEN",
        })
        return
      }
      onDone()
    },
  })

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
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="New password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message}{" "}
              {error.expired && (
                <Link to="/forgot-password" className="underline">
                  Ask for a new link
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              Save password
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
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
