import { FieldGroup } from "@workspace/ui/components/field"

import { withFieldGroup } from "@/lib/form"

// A party's five parts, used for every party of every document (spec §5
// Forms). The keys only map the group onto the form's inputs.
const party = { company: "", name: "", title: "", email: "", address: "" }
const labels = {
  company: "Company",
  name: "Name",
  title: "Title",
  email: "Email",
  address: "Address",
}

export const PartyFields = withFieldGroup({
  defaultValues: party,
  render: function Render({ group }) {
    return (
      <FieldGroup>
        <div className="grid gap-4 @md/field-group:grid-cols-2">
          <group.AppField name="company">
            {(field) => (
              <field.TextField
                label={labels.company}
                autoComplete="organization"
              />
            )}
          </group.AppField>
          <group.AppField name="name">
            {(field) => (
              <field.TextField label={labels.name} autoComplete="name" />
            )}
          </group.AppField>
          <group.AppField name="title">
            {(field) => (
              <field.TextField
                label={labels.title}
                autoComplete="organization-title"
              />
            )}
          </group.AppField>
          <group.AppField name="email">
            {(field) => (
              <field.TextField
                label={labels.email}
                type="email"
                autoComplete="email"
              />
            )}
          </group.AppField>
        </div>
        <group.AppField name="address">
          {(field) => (
            <field.LongTextField
              label={labels.address}
              help="An email or a postal address is needed for notices."
            />
          )}
        </group.AppField>
      </FieldGroup>
    )
  },
})
