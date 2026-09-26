import { US_STATES } from "@workspace/documents"
import { FieldGroup } from "@workspace/ui/components/field"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { withFieldGroup } from "@/lib/form"

// Governing law and courts (spec §5 Forms). The courts always sit in the
// governing-law place (the engine builds "courts located in …, <state>"), so
// this asks only for the city or county. Where the terms allow it, a province
// or country can stand in for a US state; picking one hides the other.

const states = Object.entries(US_STATES).map(([value, label]) => ({
  value,
  label,
}))

export const JurisdictionFields = withFieldGroup({
  defaultValues: { state: "", region: "", courtLocation: "", "@place": "" },
  props: { world: false },
  render: function Render({ group, world }) {
    return (
      <FieldGroup>
        {world && (
          <group.Field name="@place">
            {(field) => (
              <ToggleGroup
                aria-label="Kind of place"
                value={[field.state.value || "us"]}
                onValueChange={(value: string[]) =>
                  field.handleChange(value[0] === "world" ? "world" : "us")
                }
                className="self-start"
              >
                <ToggleGroupItem value="us">US state</ToggleGroupItem>
                <ToggleGroupItem value="world">
                  Province or country
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </group.Field>
        )}
        <group.Subscribe selector={(state) => state.values["@place"]}>
          {(place) =>
            world && place === "world" ? (
              <group.AppField name="region">
                {(field) => (
                  <field.TextField
                    label="Province or country"
                    help="Like “Ontario, Canada”."
                  />
                )}
              </group.AppField>
            ) : (
              <group.AppField name="state">
                {(field) => (
                  <field.PickField
                    label="State"
                    options={states}
                    placeholder="Type a state"
                  />
                )}
              </group.AppField>
            )
          }
        </group.Subscribe>
        <group.AppField name="courtLocation">
          {(field) => (
            <field.TextField
              label="Courts"
              help="The city or county whose courts hear disputes."
            />
          )}
        </group.AppField>
      </FieldGroup>
    )
  },
})
