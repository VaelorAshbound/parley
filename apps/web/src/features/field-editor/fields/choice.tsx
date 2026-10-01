import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import type { ReactNode } from "react"

import { type Labels, useControl } from "./control"

// A choice is a set of option cards (the shadcn "choice card"): the options
// are whole sentences from the contract, too long for a ToggleGroup. The
// picked option's blanks open under it.
// https://ui.shadcn.com/docs/forms/tanstack-form#radio-group

export type OptionView = {
  value: string
  /** The option's words, with its blanks named: "Expires [MNDA length]…". */
  label: string
  /** The blanks' inputs, shown while the option is picked. */
  blanks?: ReactNode
}

export function ChoiceField({
  options,
  hideLabel,
  ...labels
}: Labels & { options: OptionView[]; hideLabel?: boolean }) {
  const { field, errors, invalid, props } = useControl()
  return (
    <FieldSet data-invalid={invalid}>
      <FieldLegend
        variant="label"
        className={hideLabel ? "sr-only" : undefined}
      >
        {labels.label}
      </FieldLegend>
      {labels.help && <FieldDescription>{labels.help}</FieldDescription>}
      <RadioGroup
        name={props.name}
        value={props.value}
        onValueChange={(value) => field.handleChange(String(value))}
      >
        {options.map((option) => {
          const id = `${props.name}/=${option.value}`
          return (
            <div key={option.value} className="flex flex-col gap-2">
              <FieldLabel htmlFor={id}>
                <Field orientation="horizontal" data-invalid={invalid}>
                  <RadioGroupItem
                    id={id}
                    value={option.value}
                    aria-invalid={invalid}
                  />
                  <FieldContent>
                    <FieldTitle className="font-normal">
                      {option.label}
                    </FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
              {option.blanks && props.value === option.value && (
                <div className="flex flex-col gap-3 pl-7">{option.blanks}</div>
              )}
            </div>
          )
        })}
      </RadioGroup>
      <FieldError errors={errors} />
    </FieldSet>
  )
}

/** One option of a multi-select: a checkbox card, "on" when ticked. */
export function CheckField({
  label,
  blanks,
}: {
  label: string
  blanks?: ReactNode
}) {
  const { field, invalid, props } = useControl()
  const checked = props.value === "on"
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={props.id}>
        <Field orientation="horizontal" data-invalid={invalid}>
          <Checkbox
            id={props.id}
            name={props.name}
            checked={checked}
            onCheckedChange={(next) => field.handleChange(next ? "on" : "")}
            aria-invalid={invalid}
          />
          <FieldContent>
            <FieldTitle className="font-normal">{label}</FieldTitle>
          </FieldContent>
        </Field>
      </FieldLabel>
      {blanks && checked && (
        <div className="flex flex-col gap-3 pl-7">{blanks}</div>
      )}
    </div>
  )
}
