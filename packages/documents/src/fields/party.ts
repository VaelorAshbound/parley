import { z } from "../zod.ts"
import {
  mergeParts,
  plainText,
  withMeta,
  type Common,
  type ObjectField,
} from "./core.ts"

// --- Party ---

const partyParts = {
  company: plainText(200),
  name: plainText(200),
  title: plainText(200),
  email: z.email("Use a real email address.").max(254),
  address: plainText(500),
}

export function party(config: Common<never>) {
  const base = z.strictObject({
    company: partyParts.company,
    name: partyParts.name,
    title: partyParts.title,
    email: partyParts.email.exactOptional(),
    address: partyParts.address.exactOptional(),
  })
  type Value = z.infer<typeof base>
  const draftSchema = withMeta(base.exactPartial(), config)
  type Draft = z.infer<typeof draftSchema>
  return {
    kind: "party",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: undefined,
    subfields: {
      company: "Company",
      name: "Name",
      title: "Title",
      email: "Email",
      address: "Address",
    },
    // Where notices go: the email and/or the postal address.
    derived: { notice: "Notice address" },
    // Notices go to an email or a postal address (the NDA cover page's
    // "Notice Address"), so a complete party needs at least one.
    schema: withMeta(
      base.refine(
        (value) => value.email !== undefined || value.address !== undefined,
        {
          message: "Add an email or a postal address for notices.",
          path: ["email"],
        }
      ),
      config
    ),
    draftSchema,
    changeSchema: withMeta(
      z
        .strictObject({
          company: partyParts.company.nullable(),
          name: partyParts.name.nullable(),
          title: partyParts.title.nullable(),
          email: partyParts.email.nullable(),
          address: partyParts.address.nullable(),
        })
        .exactPartial(),
      config
    ),
    merge: mergeParts,
    merges: "parts",
    format: (value) => value.company ?? null,
    formatPath: (value, part) =>
      part === "notice"
        ? [value.email, value.address].filter(Boolean).join("\n") || null
        : (value[part] ?? null),
  } satisfies ObjectField<"party", Value, Draft, "notice">
}
