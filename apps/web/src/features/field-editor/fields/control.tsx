import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import type { ReactNode } from "react"

import { useFieldContext } from "@/lib/form-context"

// What every input of the editor shares: its label, its help, and its error,
// wired the shadcn way (data-invalid on Field, aria-invalid on the control).
// https://ui.shadcn.com/docs/forms/tanstack-form

export type Labels = { label: string; help?: string | undefined }

/** The field's errors as FieldError takes them. Our validators give text. */
export function errorsOf(errors: readonly unknown[]) {
  return errors.flatMap((error) =>
    typeof error === "string" && error ? [{ message: error }] : []
  )
}

/** The bound input's state, for a control to spread its props from. */
export function useControl() {
  const field = useFieldContext<string>()
  const errors = errorsOf(field.state.meta.errors)
  return {
    field,
    errors,
    invalid: errors.length > 0,
    props: {
      id: field.name,
      name: field.name,
      value: field.state.value ?? "",
      onBlur: field.handleBlur,
      "aria-invalid": errors.length > 0,
    },
  }
}

export function Control({
  label,
  help,
  hideLabel = false,
  children,
}: Labels & { hideLabel?: boolean; children: ReactNode }) {
  const { field, errors, invalid } = useControl()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name} className={hideLabel ? "sr-only" : ""}>
        {label}
      </FieldLabel>
      {children}
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError errors={errors} />
    </Field>
  )
}

/**
 * The errors of a field that has no input of its own: a choice list, a party
 * as a whole ("The two parties must be different companies").
 */
export function ErrorSlot() {
  const { errors } = useControl()
  return <FieldError errors={errors} />
}
