import { revalidateLogic } from "@tanstack/react-form"
import {
  applyFieldChanges,
  type ChangeIssue,
  type DocumentDefinition,
} from "@workspace/documents"
import { Button } from "@workspace/ui/components/button"
import { dequal } from "dequal/lite"
import { useEffect, useRef, useState } from "react"

import { useAppForm } from "@/lib/form"

import { FieldInputs } from "./field-inputs"
import { changeOf, inputFor, inputsOf, type Inputs } from "./model"

// The inline editor (spec §1 story 4, brand.md → "Editing"): one field's
// form, in place of its row in the document. The engine that the server runs
// checks every change here first, so errors show before anything is sent,
// on the input they are about.

/** A save the server refused: what was typed, and why it was refused. */
export type Recovery = { inputs: Inputs; issues: ChangeIssue[] }

type Props = {
  definition: DocumentDefinition
  /** The draft's current values. */
  values: Record<string, unknown>
  fieldKey: string
  /** The part to focus first: "party1.email". */
  focus?: string | undefined
  recovery?: Recovery | undefined
  onSave: (change: unknown, inputs: Inputs) => void
  onCancel: () => void
}

export function FieldEditor({
  definition,
  values,
  fieldKey,
  focus,
  recovery,
  onSave,
  onCancel,
}: Props) {
  const field = definition.fields[fieldKey]
  if (!field) throw new Error(`No field "${fieldKey}" in ${definition.id}`)
  const [initial] = useState(() => ({
    ...inputsOf(field, values[fieldKey], fieldKey),
    ...recovery?.inputs,
  }))
  const container = useRef<HTMLFormElement>(null)

  /** The issues as field errors: each on the input it names. */
  const errorsOf = (issues: ChangeIssue[], inputs: Inputs) => {
    if (issues.length === 0) return undefined
    const fields: Record<string, string> = {}
    for (const issue of issues) {
      const name = inputFor(field, issue.path, fieldKey, inputs)
      fields[name] ??= issue.message
    }
    return { fields }
  }

  const form = useAppForm({
    defaultValues: initial,
    // Quiet while you type the first time; after a save attempt, errors
    // update as you fix them (spec §5 Forms).
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: ({ value }) => {
        // What the server refused stays shown until you change something.
        if (recovery && dequal(value, initial))
          return errorsOf(recovery.issues, value)
        const { rejected } = applyFieldChanges(definition, values, [
          { key: fieldKey, value: changeOf(field, value, fieldKey) },
        ])
        return errorsOf(
          rejected.flatMap((each) => each.issues),
          value
        )
      },
    },
    onSubmit: ({ value }) => onSave(changeOf(field, value, fieldKey), value),
  })

  useEffect(() => {
    const root = container.current
    if (!root) return
    // A party's notice address is its email or postal address: start there.
    const wanted = focus?.replace(/\.notice$/, ".email").replace(".", "/")
    const target =
      (wanted &&
        root.querySelector<HTMLElement>(`[id="${CSS.escape(wanted)}"]`)) ||
      root.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([aria-hidden=true]), textarea, [role=radio], [role=checkbox], [role=combobox]"
      )
    target?.focus()
    // Show what the server refused at once.
    if (recovery) void form.handleSubmit()
    // Only when the editor opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Shortcuts for the form's own inputs: Esc cancels, Enter saves.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      ref={container}
      noValidate
      aria-label={`Edit ${field.label}`}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return
        if (event.key === "Escape") {
          event.preventDefault()
          onCancel()
        }
        // Enter on a radio or checkbox saves too, like in a text box.
        const role =
          event.target instanceof Element
            ? event.target.getAttribute("role")
            : null
        if (
          event.key === "Enter" &&
          (role === "radio" || role === "checkbox")
        ) {
          event.preventDefault()
          void form.handleSubmit()
        }
      }}
      className="@container/field-group flex flex-col gap-4 rounded-lg border-[1.5px] border-blue-ink bg-card p-4 font-sans text-sm text-card-foreground shadow-[0_0_0_3px_var(--color-blue-tint)]"
    >
      <form.AppForm>
        <FieldInputs form={form} field={field} name={fieldKey} root />
      </form.AppForm>
      <div className="flex items-center gap-2">
        <p className="mr-auto text-xs text-muted-foreground max-sm:hidden">
          Enter to save · Esc to cancel
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  )
}
