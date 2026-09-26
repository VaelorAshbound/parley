import { createFormHook } from "@tanstack/react-form"

import { PasswordField } from "@/features/auth/password-field"
import { ErrorSlot } from "@/features/field-editor/fields/control"
import { CheckField, ChoiceField } from "@/features/field-editor/fields/choice"
import { PickField, SelectField } from "@/features/field-editor/fields/pickers"
import {
  DateField,
  LongTextField,
  NumberField,
  TextField,
  UrlField,
} from "@/features/field-editor/fields/text"

import { fieldContext, formContext } from "./form-context"

// The app's one form kit (spec §5 Forms). No feature calls useForm directly:
// forms come from useAppForm, and their inputs from the components below, so
// every form wires labels, help and errors the same way.
// https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    LongTextField,
    DateField,
    UrlField,
    NumberField,
    PickField,
    SelectField,
    ChoiceField,
    CheckField,
    ErrorSlot,
    PasswordField,
  },
  formComponents: {},
})
