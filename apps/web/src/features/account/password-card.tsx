import { isDefinedError, safe } from "@orpc/client"
import { revalidateLogic } from "@tanstack/react-form"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { useQueryClient } from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { useState } from "react"
import { z } from "zod"

import { authErrorMessage } from "@/features/auth/messages"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { ConfirmIdentity, isFresh } from "./confirm-identity"
import { idle, SubmitRow, type Status } from "./form-status"

const newPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")

type Account = {
  hasPassword: boolean
  providers: ("google" | "github")[]
  freshUntil: Date
}

/** Change the password, or add one to a Google or GitHub account. */
export function PasswordCard({ account }: { account: Account }) {
  // Adding a password turns the form below into "change password".
  const [added, setAdded] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Password</h2>
        </CardTitle>
        <CardDescription>
          {account.hasPassword
            ? "Use at least 10 characters."
            : "You sign in with Google or GitHub. Add a password to sign in with your email too."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {added && (
          <Alert>
            <AlertDescription>
              Password added. You can sign in with your email too.
            </AlertDescription>
          </Alert>
        )}
        {account.hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <SetPasswordForm account={account} onAdded={() => setAdded(true)} />
        )}
      </CardContent>
    </Card>
  )
}

const changeSchema = z.object({
  current: z.string().min(1, "Please enter your current password."),
  next: newPassword,
  signOutOthers: z.string(),
})

function ChangePasswordForm() {
  const { orpc } = useRouteContext({ from: "/_app" })
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>(idle)

  const form = useAppForm({
    // Signing the other devices out is the safe choice after a leak.
    defaultValues: { current: "", next: "", signOutOthers: "on" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: changeSchema },
    onSubmit: async ({ value }) => {
      setStatus(idle)
      const { error } = await authClient.changePassword({
        currentPassword: value.current,
        newPassword: value.next,
        revokeOtherSessions: value.signOutOthers === "on",
      })
      if (error) {
        setStatus({ kind: "error", message: authErrorMessage(error) })
        return
      }
      form.reset()
      setStatus({ kind: "done", message: "Password changed." })
      await queryClient.invalidateQueries({
        queryKey: orpc.account.sessions.key(),
      })
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
        <form.AppField name="current">
          {(field) => (
            <field.PasswordField
              label="Current password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        <form.AppField name="next">
          {(field) => (
            <field.PasswordField
              label="New password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        <form.AppField name="signOutOthers">
          {(field) => <field.CheckField label="Sign out on other devices" />}
        </form.AppField>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <SubmitRow status={status} submitting={submitting}>
              Change password
            </SubmitRow>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}

const setSchema = z.object({ next: newPassword })

function SetPasswordForm({
  account,
  onAdded,
}: {
  account: Account
  onAdded: () => void
}) {
  const { orpc } = useRouteContext({ from: "/_app" })
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>(idle)
  const [confirm, setConfirm] = useState(false)

  const form = useAppForm({
    defaultValues: { next: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: setSchema },
    onSubmit: async ({ value }) => {
      setStatus(idle)
      if (!isFresh(account.freshUntil)) {
        setConfirm(true)
        return
      }
      const { error } = await safe(
        orpc.account.setPassword.call({ newPassword: value.next })
      )
      if (isDefinedError(error) && error.code === "SESSION_NOT_FRESH") {
        setConfirm(true)
        return
      }
      if (error) {
        setStatus({
          kind: "error",
          message: isDefinedError(error)
            ? error.message
            : "Something went wrong. Please try again.",
        })
        return
      }
      onAdded()
      await queryClient.invalidateQueries({
        queryKey: orpc.account.get.key(),
      })
    },
  })

  if (confirm) return <ConfirmIdentity providers={account.providers} />

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
        <form.AppField name="next">
          {(field) => (
            <field.PasswordField
              label="New password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <SubmitRow status={status} submitting={submitting}>
              Add password
            </SubmitRow>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
