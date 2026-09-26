import { describe, expect, it } from "vite-plus/test"

import { field } from "../src/fields.ts"
import { z } from "../src/zod.ts"

const subprocessors = field.list({
  label: "Approved subprocessors",
  help: "Who else handles the personal data.",
  item: {
    name: field.text({ label: "Name", help: "The company." }),
    country: field.text({ label: "Country", help: "Where it processes data." }),
    task: field.text({ label: "Task", help: "What it does." }),
  },
})

describe("list", () => {
  const aws = { name: "AWS", country: "United States", task: "Hosting" }

  it("holds complete records once complete, and partial ones while drafting", () => {
    expect(subprocessors.schema.parse([aws])).toEqual([aws])
    expect(subprocessors.schema.safeParse([{ name: "AWS" }]).success).toBe(
      false
    )
    expect(subprocessors.draftSchema.safeParse([{ name: "AWS" }]).success).toBe(
      true
    )
  })

  it("needs at least one record once complete", () => {
    expect(subprocessors.schema.safeParse([]).success).toBe(false)
  })

  it("formats each record on its own line", () => {
    expect(
      subprocessors.format([
        aws,
        { name: "Stripe", country: "Ireland", task: "Billing" },
      ])
    ).toBe("AWS, United States, Hosting\nStripe, Ireland, Billing")
    expect(subprocessors.format([{ name: "AWS" }])).toBe("AWS")
  })

  it("stores one tidy shape: empty records dropped, empty list cleared", () => {
    expect(subprocessors.merge(undefined, [{}, aws, {}])).toEqual([aws])
    expect(subprocessors.merge([aws], [])).toBeUndefined()
    expect(subprocessors.merge([aws], null)).toBeUndefined()
  })

  it("names its columns for the table", () => {
    expect(subprocessors.columns).toEqual({
      name: "Name",
      country: "Country",
      task: "Task",
    })
  })

  it("can need several records, and leave a column optional", () => {
    const tiers = field.list({
      label: "Uptime credits",
      help: "Credit per uptime range.",
      item: {
        range: field.text({ label: "Uptime", help: "The range." }),
        note: field.text({
          label: "Note",
          help: "Anything else.",
          optional: true,
        }),
      },
      min: 2,
    })

    expect(
      tiers.schema.safeParse([{ range: "99%" }]).error?.issues[0]?.message
    ).toBe("Add at least 2.")
    expect(
      tiers.schema.safeParse([{ range: "99%" }, { range: "95%" }]).success
    ).toBe(true)
    expect(tiers.format([])).toBeNull()
  })

  it("caps the number of records", () => {
    const many = Array.from({ length: 51 }, () => aws)

    expect(subprocessors.draftSchema.safeParse(many).success).toBe(false)
  })

  it("gives the AI tools its label and each column's help", () => {
    const json = JSON.stringify(z.toJSONSchema(subprocessors.changeSchema))

    expect(json).toContain("Who else handles the personal data.")
    expect(json).toContain("Where it processes data.")
  })
})

const measures = field.group({
  label: "Technical and organisational measures",
  help: "How the provider keeps personal data safe.",
  parts: {
    encryption: field.longText({
      label: "Measures of pseudonymisation and encryption of personal data",
      help: "How data is encrypted.",
      optional: true,
    }),
    access: field.longText({
      label: "Measures for user identification and authorisation",
      help: "Who can get in, and how.",
      optional: true,
    }),
  },
  min: 1,
})

describe("group", () => {
  it("fills any of its parts, and needs its minimum once complete", () => {
    expect(
      measures.schema.safeParse({ encryption: "AES-256 at rest." }).success
    ).toBe(true)
    expect(measures.schema.safeParse({}).success).toBe(false)
    expect(measures.draftSchema.safeParse({}).success).toBe(true)
  })

  it("requires the parts that are not optional", () => {
    const signer = field.group({
      label: "Signer",
      help: "Who signs.",
      parts: {
        name: field.text({ label: "Name", help: "Full name." }),
        role: field.text({ label: "Role", help: "Job title.", optional: true }),
      },
    })

    expect(signer.schema.safeParse({ role: "CEO" }).success).toBe(false)
    expect(signer.schema.safeParse({ name: "Ana" }).success).toBe(true)
  })

  it("changes part by part, and null removes a part", () => {
    expect(
      measures.merge(
        { encryption: "AES." },
        { access: "SSO.", encryption: null }
      )
    ).toEqual({ access: "SSO." })
    expect(measures.merges).toBe("parts")
  })

  it("formats the filled parts, and each part on its own", () => {
    const value = { encryption: "AES-256 at rest.", access: "SSO with MFA." }

    expect(measures.format(value)).toBe(
      "Measures of pseudonymisation and encryption of personal data: AES-256 at rest.\nMeasures for user identification and authorisation: SSO with MFA."
    )
    expect(measures.formatPath(value, "access")).toBe("SSO with MFA.")
    expect(measures.formatPath({}, "access")).toBeNull()
    expect(measures.format({})).toBeNull()
  })

  it("names its parts for forms and placeholders", () => {
    expect(measures.subfields).toEqual({
      encryption:
        "Measures of pseudonymisation and encryption of personal data",
      access: "Measures for user identification and authorisation",
    })
  })
})
