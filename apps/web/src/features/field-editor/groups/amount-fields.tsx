import { unitWords, type Unit } from "@workspace/documents"
import { FieldDescription } from "@workspace/ui/components/field"

import { withFieldGroup } from "@/lib/form"

// A number with its unit on one row: a duration ("2 years") or money
// ("1,200 USD"). The help sits under the row, not under the number.

const someUnits: readonly Unit[] = ["years"]

export const DurationFields = withFieldGroup({
  defaultValues: { amount: "", unit: "" },
  props: {
    label: "Length",
    help: "",
    units: someUnits,
  },
  render: function Render({ group, label, help, units }) {
    const options = units.map((unit) => ({
      value: unit,
      label: unitWords[unit][1],
    }))
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="w-28">
            <group.AppField name="amount">
              {(field) => <field.NumberField label={label} />}
            </group.AppField>
          </div>
          <div className="w-44">
            <group.AppField name="unit">
              {(field) => (
                <field.SelectField
                  label="Unit"
                  options={options}
                  placeholder="Unit"
                />
              )}
            </group.AppField>
          </div>
        </div>
        {help && <FieldDescription>{help}</FieldDescription>}
      </div>
    )
  },
})

export const MoneyFields = withFieldGroup({
  defaultValues: { amount: "", currency: "" },
  props: { label: "Amount", help: "" },
  render: function Render({ group, label, help }) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="w-40">
            <group.AppField name="amount">
              {(field) => <field.NumberField label={label} />}
            </group.AppField>
          </div>
          <div className="w-24">
            <group.AppField name="currency">
              {(field) => (
                <field.TextField label="Currency" autoComplete="off" />
              )}
            </group.AppField>
          </div>
        </div>
        {help && <FieldDescription>{help}</FieldDescription>}
      </div>
    )
  },
})
