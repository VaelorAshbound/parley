import { createFormHookContexts } from "@tanstack/react-form"

// The contexts behind the app's form kit (src/lib/form.ts). Kept apart so
// field components can read them without importing the kit that lists them.
// https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
