import { useStore } from "@tanstack/react-form"
import type { AnyField } from "@workspace/documents"
import { Button } from "@workspace/ui/components/button"
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { PlusIcon, XIcon } from "lucide-react"

import { withForm } from "@/lib/form"

import { DurationFields, MoneyFields } from "./groups/amount-fields"
import { JurisdictionFields } from "./groups/jurisdiction-fields"
import { PartyFields } from "./groups/party-fields"
import {
  addRow,
  blanksOf,
  isWorld,
  optionText,
  removeRow,
  rowCount,
  type Inputs,
} from "./model"

// The inputs of any field kind, named as the model names them (./model.ts).
// Recursive: a choice's blank, a group's part and a list's cell are fields
// too, and a blank can even be another choice.

const inputs: Inputs = {}
const props: { field: AnyField | null; name: string; root: boolean } = {
  field: null,
  name: "",
  // The field being edited, not one of its blanks: its label is the row's
  // heading, already on the page above the editor.
  root: false,
}

export const FieldInputs = withForm({
  defaultValues: inputs,
  props,
  render: function Render({ form, field, name, root }) {
    const values = useStore(form.store, (state) => state.values)
    if (!field) return null
    // The row's heading and hint are right above the editor, so the field
    // being edited doesn't repeat them.
    const labels = {
      label: field.label,
      help: root ? undefined : field.help,
      hideLabel: root,
    }
    const at = (part: string | number) => `${name}/${part}`

    switch (field.kind) {
      case "text":
        return (
          <form.AppField name={name}>
            {(input) => <input.TextField {...labels} />}
          </form.AppField>
        )
      case "longText":
        return (
          <form.AppField name={name}>
            {(input) => <input.LongTextField {...labels} />}
          </form.AppField>
        )
      case "url":
        return (
          <form.AppField name={name}>
            {(input) => <input.UrlField {...labels} />}
          </form.AppField>
        )
      case "date":
        return (
          <form.AppField name={name}>
            {(input) => <input.DateField {...labels} />}
          </form.AppField>
        )
      case "number":
      case "percent":
        return (
          <div className="max-w-44">
            <form.AppField name={name}>
              {(input) => (
                <input.NumberField
                  {...labels}
                  suffix={field.kind === "percent" ? "%" : undefined}
                />
              )}
            </form.AppField>
          </div>
        )
      case "select":
        return (
          <form.AppField name={name}>
            {(input) => (
              <input.PickField
                {...labels}
                options={Object.entries(field.options).map(
                  ([value, label]) => ({ value, label })
                )}
                placeholder="Type to search"
              />
            )}
          </form.AppField>
        )
      case "duration":
        return (
          <DurationFields
            form={form}
            fields={{ amount: at("amount"), unit: at("unit") }}
            label={field.label}
            help={field.help}
            units={field.units}
          />
        )
      case "money":
        return (
          <MoneyFields
            form={form}
            fields={{ amount: at("amount"), currency: at("currency") }}
            label={field.label}
            help={field.help}
          />
        )
      case "choice":
        return (
          <form.AppField name={name}>
            {(input) => (
              <input.ChoiceField
                {...labels}
                options={[
                  ...Object.entries(field.options).map(([key, option]) => ({
                    value: key,
                    label: optionText(option),
                    blanks: (
                      <Blanks form={form} option={option} prefix={at(key)} />
                    ),
                  })),
                  ...(field.allowOther
                    ? [
                        {
                          value: "other",
                          label: "Other",
                          blanks: (
                            <form.AppField name={at("@other/text")}>
                              {(text) => <text.TextField label="Other" />}
                            </form.AppField>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </form.AppField>
        )
      case "choices":
        return (
          <FieldSet>
            <FieldLegend
              variant="label"
              className={root ? "sr-only" : undefined}
            >
              {field.label}
            </FieldLegend>
            {!root && <FieldDescription>{field.help}</FieldDescription>}
            {Object.entries(field.options).map(([key, option]) => (
              <form.AppField key={key} name={at(key)}>
                {(input) => (
                  <input.CheckField
                    label={optionText(option)}
                    blanks={
                      <Blanks form={form} option={option} prefix={at(key)} />
                    }
                  />
                )}
              </form.AppField>
            ))}
            {field.allowOther && (
              <form.AppField name={at("@other")}>
                {(input) => (
                  <input.CheckField
                    label="Other"
                    blanks={
                      <form.AppField name={at("@other/text")}>
                        {(text) => <text.TextField label="Other" />}
                      </form.AppField>
                    }
                  />
                )}
              </form.AppField>
            )}
            <form.AppField name={name}>
              {(input) => <input.ErrorSlot />}
            </form.AppField>
          </FieldSet>
        )
      case "list": {
        const count = rowCount(values, name)
        const apply = (updates: Inputs) => {
          for (const [key, value] of Object.entries(updates))
            form.setFieldValue(key, value)
        }
        return (
          <FieldSet>
            <FieldLegend
              variant="label"
              className={root ? "sr-only" : undefined}
            >
              {field.label}
            </FieldLegend>
            {!root && <FieldDescription>{field.help}</FieldDescription>}
            {Array.from({ length: count }, (_, row) => (
              <FieldSet
                key={row}
                aria-label={`Row ${row + 1}`}
                className="rounded-lg border p-3"
              >
                <div className="flex items-start gap-2">
                  <FieldGroup className="flex-1">
                    {Object.entries(field.item).map(([column, cell]) => (
                      <FieldInputs
                        key={column}
                        form={form}
                        field={cell}
                        name={at(`${row}/${column}`)}
                        root={false}
                      />
                    ))}
                  </FieldGroup>
                  {count > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove row ${row + 1}`}
                      onClick={() => apply(removeRow(values, name, row))}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
              </FieldSet>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => apply(addRow(field, values, name))}
            >
              <PlusIcon data-icon="inline-start" />
              Add a row
            </Button>
            <form.AppField name={name}>
              {(input) => <input.ErrorSlot />}
            </form.AppField>
          </FieldSet>
        )
      }
      case "group":
        return (
          <FieldGroup>
            <form.AppField name={name}>
              {(input) => <input.ErrorSlot />}
            </form.AppField>
            {Object.entries(field.parts ?? {}).map(([part, partField]) => (
              <FieldInputs
                key={part}
                form={form}
                field={partField}
                name={at(part)}
                root={false}
              />
            ))}
          </FieldGroup>
        )
      case "party":
        return (
          <FieldGroup>
            <form.AppField name={name}>
              {(input) => <input.ErrorSlot />}
            </form.AppField>
            <PartyFields
              form={form}
              fields={{
                company: at("company"),
                name: at("name"),
                title: at("title"),
                email: at("email"),
                address: at("address"),
              }}
            />
          </FieldGroup>
        )
      case "jurisdiction":
        return (
          <FieldGroup>
            <form.AppField name={name}>
              {(input) => <input.ErrorSlot />}
            </form.AppField>
            <JurisdictionFields
              form={form}
              fields={{
                state: at("state"),
                region: at("region"),
                courtLocation: at("courtLocation"),
                "@place": at("@place"),
              }}
              world={isWorld(field)}
            />
          </FieldGroup>
        )
    }
  },
})

/** The inputs of an option's blanks, under the option while it's picked. */
const blankProps: {
  option: {
    label: string
    with?: AnyField
    blanks?: Readonly<Record<string, AnyField>>
  }
  prefix: string
} = { option: { label: "" }, prefix: "" }

const Blanks = withForm({
  defaultValues: inputs,
  props: blankProps,
  render: function Render({ form, option, prefix }) {
    return blanksOf(option).map(([blank, blankField]) => (
      <FieldInputs
        key={blank}
        form={form}
        field={blankField}
        name={`${prefix}/${blank}`}
        root={false}
      />
    ))
  },
})
