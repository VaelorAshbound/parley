import { revalidateLogic } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
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
import { viewerQuery, type Viewer } from "@/lib/session"

import { idle, SubmitRow, type Status } from "./form-status"

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
})

/** The name Parley shows in the sidebar (Better Auth's updateUser). */
export function ProfileCard({ account }: { account: NonNullable<Viewer> }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [status, setStatus] = useState<Status>(idle)

  const form = useAppForm({
    defaultValues: { name: account.name },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setStatus(idle)
      const name = value.name.trim()
      const { error } = await authClient.updateUser({ name })
      if (error) {
        setStatus({ kind: "error", message: authErrorMessage(error) })
        return
      }
      // The sidebar shows the new name at once.
      queryClient.setQueryData(
        viewerQuery.queryKey,
        (viewer) => viewer && { ...viewer, name }
      )
      await router.invalidate()
      setStatus({ kind: "done", message: "Saved." })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Name</h2>
        </CardTitle>
        <CardDescription>How Parley greets you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
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
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <SubmitRow status={status} submitting={submitting}>
                  Save name
                </SubmitRow>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
