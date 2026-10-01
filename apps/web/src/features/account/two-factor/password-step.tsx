import { revalidateLogic } from "@tanstack/react-form"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { z } from "zod"

import { type AuthError, authErrorMessage } from "@/features/auth/messages"
import { useAppForm } from "@/lib/form"

const schema = z.object({
  password: z.string().min(1, "Please enter your password."),
})

/**
 * The password, before any change to two-factor sign-in (Better Auth asks
 * for it on each). `onPassword` answers with Better Auth's error, if any.
 */
export function PasswordStep({
  action,
  destructive = false,
  onPassword,
}: {
  /** The button's words. */
  action: string
  destructive?: boolean
  onPassword: (password: string) => Promise<AuthError | null>
}) {
  const [error, setError] = useState<string>()

  const form = useAppForm({
    defaultValues: { password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const problem = await onPassword(value.password)
      if (problem) setError(authErrorMessage(problem))
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
      <DialogFooter showCloseButton>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={submitting}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {action}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
