import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Textarea } from "@workspace/ui/components/textarea"

import { useFormContext } from "@/lib/form-context"

import { Control, type Labels, useControl } from "./control"

// The typed inputs: text, long text, date, link, number and percent. Each
// holds text; the model (../model.ts) turns it into the field's value.

export function TextField({
  type = "text",
  autoComplete = "off",
  hideLabel,
  ...labels
}: Labels & {
  type?: "text" | "email" | "url" | "date"
  autoComplete?: string
  hideLabel?: boolean
}) {
  const { field, props } = useControl()
  return (
    <Control {...labels} hideLabel={hideLabel}>
      <Input
        {...props}
        type={type}
        autoComplete={autoComplete}
        inputMode={type === "url" ? "url" : undefined}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    </Control>
  )
}

export function DateField(labels: Labels & { hideLabel?: boolean }) {
  return <TextField {...labels} type="date" />
}

export function UrlField(labels: Labels & { hideLabel?: boolean }) {
  return <TextField {...labels} type="url" />
}

/** Enter saves, like every other box; Shift+Enter starts a new line. */
export function LongTextField({
  hideLabel,
  ...labels
}: Labels & { hideLabel?: boolean }) {
  const form = useFormContext()
  const { field, props } = useControl()
  return (
    <Control {...labels} hideLabel={hideLabel}>
      <Textarea
        {...props}
        rows={3}
        className="field-sizing-content max-h-60 min-h-16"
        onChange={(event) => field.handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return
          if (event.nativeEvent.isComposing) return
          event.preventDefault()
          void form.handleSubmit()
        }}
      />
    </Control>
  )
}

export function NumberField({
  suffix,
  hideLabel,
  ...labels
}: Labels & { suffix?: string; hideLabel?: boolean }) {
  const { field, props } = useControl()
  const input = {
    ...props,
    type: "number",
    inputMode: "decimal" as const,
    step: "any",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      field.handleChange(event.target.value),
  }
  return (
    <Control {...labels} hideLabel={hideLabel}>
      {suffix ? (
        <InputGroup>
          <InputGroupInput {...input} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...input} />
      )}
    </Control>
  )
}
