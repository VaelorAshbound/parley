import { describe, expect, it } from "vite-plus/test"

import { field } from "../src/fields.ts"
import { z } from "../src/zod.ts"

// Multi-select: Common Paper's "[ ] pick none, one, or more than one".
const training = field.choices({
  label: "Training data",
  help: "Which customer data the provider may train on.",
  options: {
    none: { label: "None" },
    usageData: { label: "Usage Data" },
    feedback: { label: "Feedback" },
    prompts: {
      label: "User prompts, limited to {value}",
      with: field.text({ label: "Limit", help: "What is left out." }),
    },
  },
  exclusive: ["none"],
  allowOther: true,
})

describe("choices", () => {
  it("takes several options, each with its own blanks", () => {
    const input = {
      selected: [
        { option: "usageData" },
        { option: "prompts", value: "no personal data" },
      ],
      other: "Support tickets",
    }
    const value = training.schema.parse(input)

    expect(value).toEqual(input)
    expect(training.format(value)).toBe(
      "Usage Data; User prompts, limited to no personal data; Support tickets"
    )
  })

  it("won't mix an exclusive option with anything, Other included", () => {
    expect(
      training.schema.safeParse({
        selected: [{ option: "none" }, { option: "feedback" }],
      }).success
    ).toBe(false)
    expect(
      training.draftSchema.safeParse({
        selected: [{ option: "none" }],
        other: "Logs",
      }).success
    ).toBe(false)
  })

  it("takes each option once", () => {
    expect(
      training.draftSchema.safeParse({
        selected: [{ option: "feedback" }, { option: "feedback" }],
      }).success
    ).toBe(false)
  })

  it("needs at least one pick once complete, not while drafting", () => {
    expect(training.schema.safeParse({ selected: [] }).success).toBe(false)
    expect(training.draftSchema.safeParse({ selected: [] }).success).toBe(true)
  })

  it("needs every blank of a picked option once complete", () => {
    const pick = { selected: [{ option: "prompts" }] }

    expect(training.schema.safeParse(pick).success).toBe(false)
    expect(training.draftSchema.safeParse(pick).success).toBe(true)
  })

  it("stores one tidy shape: defined order, no empty items, cleared when empty", () => {
    expect(
      training.merge(undefined, {
        selected: [{ option: "feedback" }, { option: "usageData" }],
        other: "   ",
      })
    ).toEqual({ selected: [{ option: "usageData" }, { option: "feedback" }] })
    expect(training.merge(undefined, { selected: [] })).toBeUndefined()
    expect(
      training.merge({ selected: [{ option: "none" }] }, null)
    ).toBeUndefined()
  })

  it("keeps a real Other answer and drops a picked option's empty blanks", () => {
    const cap = field.choices({
      label: "Caps",
      help: "Caps.",
      options: {
        greater: {
          label: "{amount} or {multiple}x",
          blanks: {
            amount: field.money({ label: "Amount", help: "Floor." }),
            multiple: field.number({ label: "Multiple", help: "Times." }),
          },
        },
      },
      allowOther: true,
    })

    expect(
      cap.merge(undefined, {
        selected: [{ option: "greater", value: {} }],
        other: "Per claim",
      })
    ).toEqual({ selected: [{ option: "greater" }], other: "Per claim" })
  })

  it("shows nothing when nothing is picked", () => {
    expect(training.format({ selected: [] })).toBeNull()
  })

  it("can need several picks, and can go without Other", () => {
    const methods = field.choices({
      label: "Payment methods",
      help: "How the customer may pay.",
      options: { card: { label: "Card" }, invoice: { label: "Invoice" } },
      min: 2,
    })

    expect(methods.allowOther).toBe(false)
    expect(
      methods.schema.safeParse({ selected: [{ option: "card" }] }).error
        ?.issues[0]?.message
    ).toBe("Pick at least 2.")
    expect(methods.format({ selected: [{ option: "card" }] })).toBe("Card")
    expect(
      methods.draftSchema.safeParse({ selected: [], other: "x" }).success
    ).toBe(false)
  })

  it("refuses an option named 'other'", () => {
    expect(() =>
      field.choices({
        label: "Bad",
        help: "Bad.",
        options: { other: { label: "O" } },
      })
    ).toThrow('Choices "Bad": "other" is kept for the Other answer.')
  })

  it("keeps Other text short unless it asks for long answers", () => {
    const claims = field.choices({
      label: "Covered claims",
      help: "Claims each side defends.",
      options: { ip: { label: "IP infringement" } },
      allowOther: true,
      longOther: true,
    })
    const long = { selected: [], other: "x".repeat(1500) }

    expect(claims.schema.safeParse(long).success).toBe(true)
    expect(training.schema.safeParse(long).success).toBe(false)
  })

  it("refuses an exclusive option it doesn't have", () => {
    expect(() =>
      field.choices({
        label: "Bad",
        help: "Bad.",
        options: { a: { label: "A" } },
        // @ts-expect-error: the types catch it; this checks untyped callers.
        exclusive: ["b"],
      })
    ).toThrow('Choices "Bad": exclusive option "b" is not one of its options.')
  })

  it("gives the AI tools its label, help and options", () => {
    const json = JSON.stringify(
      z.toJSONSchema(training.changeSchema, { io: "input" })
    )

    expect(json).toContain("Which customer data the provider may train on.")
    expect(json).toContain('"usageData"')
  })
})
