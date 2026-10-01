import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMemo } from "react"

import { Control, type Labels, useControl } from "./control"

// Pickers for values from a fixed list. A long list (states, countries) is a
// Combobox you can type into (spec §5 UI); a short one (units) is a Select.
// Both store the option's code, never its name.

export type Choice = { value: string; label: string }

export function PickField({
  options,
  placeholder,
  hideLabel,
  ...labels
}: Labels & { options: Choice[]; placeholder?: string; hideLabel?: boolean }) {
  const { field, props } = useControl()
  // Codes as the values, names for the input and filtering.
  const labelOf = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options]
  )
  const codes = useMemo(() => options.map((option) => option.value), [options])
  return (
    <Control {...labels} hideLabel={hideLabel}>
      <Combobox
        items={codes}
        itemToStringLabel={(code: string) => labelOf.get(code) ?? code}
        value={props.value || null}
        onValueChange={(value) => field.handleChange(value ?? "")}
        autoHighlight
      >
        <ComboboxInput
          id={props.id}
          name={props.name}
          onBlur={props.onBlur}
          aria-invalid={props["aria-invalid"]}
          placeholder={placeholder}
          className="w-full max-w-72"
        />
        <ComboboxContent>
          <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
          <ComboboxList>
            {(code: string) => (
              <ComboboxItem key={code} value={code}>
                {labelOf.get(code)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Control>
  )
}

export function SelectField({
  options,
  placeholder = "Pick one",
  hideLabel,
  ...labels
}: Labels & { options: Choice[]; placeholder?: string; hideLabel?: boolean }) {
  const { field, props } = useControl()
  return (
    <Control {...labels} hideLabel={hideLabel}>
      <Select
        items={[{ value: null, label: placeholder }, ...options]}
        name={props.name}
        value={props.value || null}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <SelectTrigger
          id={props.id}
          onBlur={props.onBlur}
          aria-invalid={props["aria-invalid"]}
          className="min-w-32"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Control>
  )
}
