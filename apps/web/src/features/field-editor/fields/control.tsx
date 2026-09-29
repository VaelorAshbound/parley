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

/**
 * The field's errors as FieldError takes them. The editor's validators give
 * text; a Zod schema as the form's validator gives its issues (Standard
 * Schema), which carry a message.
 */
export function errorsOf(errors: readonly unknown[]) {
  return errors.flatMap((error) => {
    const message =
      typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error
          ? error.message
          : undefined
    return typeof message === "string" && message ? [{ message }] : []
  })
}

/** The bound input's state, for a control to spread its props from. */
export function useControl() {
  const field = useFieldContext<string>()
  const errors = errorsOf(field.state.meta.errors)
  const value = field.state.value ?? ""
  return {
    field,
    errors,
    invalid: errors.length > 0,
    props: {
      id: field.name,
      name: field.name,
      value,
      onBlur: field.handleBlur,
      "aria-invalid": errors.length > 0,
      // Text typed before the page hydrated shows in the box, but the form's
      // copy starts empty, so WebKit clears it on the next render and the
      // form sends nothing (a slow phone; CI's WebKit found it). Take it
      // once, when React takes over the box, as the composer does.
      ref: (node: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (node?.value && node.value !== value) field.handleChange(node.value)
      },
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
