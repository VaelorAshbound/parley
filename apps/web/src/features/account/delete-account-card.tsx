import { revalidateLogic } from "@tanstack/react-form"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
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
import { reloadTo } from "@/features/auth/reload-to"
import { authClient } from "@/lib/auth-client"
import { useAppForm } from "@/lib/form"

import { ConfirmIdentity, isFresh, type Login } from "./confirm-identity"

/**
 * Deletes the account and all its data (spec §5 Auth), after the password,
 * or for a Google or GitHub account a sign-in in the last 15 minutes.
 */
export function DeleteAccountCard({ account }: { account: Login }) {
  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>
          <h2>Delete account</h2>
        </CardTitle>
        <CardDescription>
          Deletes your account, every draft and every chat. This can’t be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Your drafts and chats are deleted for good. This can’t be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {account.hasPassword ? (
              <DeleteWithPassword />
            ) : (
              <DeleteAfterSignIn account={account} />
            )}
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

const schema = z.object({
  password: z.string().min(1, "Please enter your password."),
})

function DeleteWithPassword() {
  const [error, setError] = useState<string>()
  const form = useAppForm({
    defaultValues: { password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const { error } = await authClient.deleteUser({
        password: value.password,
      })
      if (error) {
        setError(authErrorMessage(error))
        return
      }
      reloadTo("/")
    },
  })

  return (
    <form
      method="post"
      noValidate
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Your password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <Footer submitting={submitting}>
            <AlertDialogAction
              type="submit"
              variant="destructive"
              disabled={submitting}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              Delete account
            </AlertDialogAction>
          </Footer>
        )}
      </form.Subscribe>
    </form>
  )
}

function DeleteAfterSignIn({ account }: { account: Login }) {
  const [confirm, setConfirm] = useState(() => !isFresh(account.freshUntil))
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()

  async function remove() {
    // The dialog may have stayed open past the 15 minutes.
    if (!isFresh(account.freshUntil)) {
      setConfirm(true)
      return
    }
    setDeleting(true)
    setError(undefined)
    const { error } = await authClient.deleteUser({})
    if (error) {
      setDeleting(false)
      if (error.code === "SESSION_EXPIRED") setConfirm(true)
      else setError(authErrorMessage(error))
      return
    }
    reloadTo("/")
  }

  if (confirm)
    return (
      <>
        <ConfirmIdentity providers={account.providers} />
        <Footer submitting={false} />
      </>
    )

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Footer submitting={deleting}>
        <AlertDialogAction
          variant="destructive"
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting && <Spinner data-icon="inline-start" />}
          Delete account
        </AlertDialogAction>
      </Footer>
    </>
  )
}

function Footer({
  submitting,
  children,
}: {
  submitting: boolean
  children?: React.ReactNode
}) {
  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
      {children}
    </AlertDialogFooter>
  )
}
