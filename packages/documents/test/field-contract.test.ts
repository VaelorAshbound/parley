import { describe, expect, it } from "vite-plus/test"

import { field } from "../src/fields.ts"
import type { z } from "../src/zod.ts"

// What the rest of the app reads from a field: its kind (the editor and the
// AI's tools switch on it), how an edit merges, the labels of its parts, and
// the words a person or the AI sees when a value is wrong. Mutation testing
// (T34) found these unchecked.

const common = { label: "Label", help: "Help." }

/** The first message a schema gives for `value`, at its path. */
function problem(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  if (result.success) return undefined
  const [issue] = result.error.issues
  return { path: issue?.path, message: issue?.message }
}

const message = (schema: z.ZodType, value: unknown) =>
  problem(schema, value)?.message

describe("each field", () => {
  const text = field.text(common)
  const kinds = [
    ["text", text, "whole"],
    ["longText", field.longText(common), "whole"],
    ["date", field.date(common), "whole"],
    ["duration", field.duration(common), "whole"],
    ["money", field.money(common), "whole"],
    ["percent", field.percent(common), "whole"],
    ["number", field.number(common), "whole"],
    ["select", field.select({ ...common, options: { a: "A" } }), "whole"],
    ["url", field.url(common), "whole"],
    ["list", field.list({ ...common, item: { name: text } }), "whole"],
    ["group", field.group({ ...common, parts: { name: text } }), "parts"],
    ["party", field.party(common), "parts"],
  ] as const

  it.each(kinds)(
    "%s says its kind and how an edit merges",
    (kind, made, merges) => {
      expect(made.kind).toBe(kind)
      expect(made.merges).toBe(merges)
    }
  )

  it("clears a whole value with null, and takes a new one", () => {
    expect(text.merge("Acme", null)).toBeUndefined()
    expect(text.merge(undefined, "Acme")).toBe("Acme")
  })
})

describe("text", () => {
  const short = field.text(common).schema
  const long = field.longText(common).schema

  it("asks for a value", () => {
    expect(message(short, "  ")).toBe("Fill this in.")
    expect(message(short, undefined)).toBe("Fill this in.")
  })

  it("names its limit, with a thousands comma", () => {
    expect(message(short, "x".repeat(201))).toBe(
      "Keep it under 200 characters."
    )
    expect(message(long, "x".repeat(2001))).toBe(
      "Keep it under 2,000 characters."
    )
  })

  it("asks to remove hidden characters", () => {
    expect(message(short, "Acme‮")).toBe("Remove hidden control characters.")
  })

  it("turns every kind of line break into a newline", () => {
    expect(long.parse("one\r\ntwo\rthree")).toBe("one\ntwo\nthree")
  })
})

describe("date, select and url", () => {
  it("say what a good value looks like", () => {
    expect(message(field.date(common).schema, "2026-02-30")).toBe(
      "Use a real date, like 2026-09-24."
    )
    const select = field.select({ ...common, options: { a: "A" } }).schema
    expect(message(select, "b")).toBe("Pick one of the options.")
    expect(message(select, undefined)).toBe("Fill this in.")
    expect(message(field.url(common).schema, "http://acme.test")).toBe(
      "Use a full https:// link."
    )
  })
})

describe("percent", () => {
  const percent = field.percent(common)

  it("stays between 0 and 100, with at most 2 decimals", () => {
    expect(message(percent.schema, -1)).toBe("At least 0%.")
    expect(message(percent.schema, 101)).toBe("At most 100%.")
    expect(message(percent.schema, 99.999)).toBe("Use at most 2 decimals.")
  })

  it("prints with a percent sign", () => {
    expect(percent.format(99.95)).toBe("99.95%")
  })
})

describe("number", () => {
  it("is whole, from 0 to a million, by default", () => {
    const number = field.number(common).schema
    expect(message(number, -1)).toBe("At least 0.")
    expect(message(number, 1_000_001)).toBe("At most 1000000.")
    expect(message(number, 1.5)).toBe("Use a whole number.")
    expect(number.parse(1_000_000)).toBe(1_000_000)
  })

  it("takes its own limits and decimals", () => {
    const multiple = field.number({
      ...common,
      min: 1,
      minExclusive: true,
      max: 10,
      decimals: 1,
    }).schema
    expect(message(multiple, 1)).toBe("More than 1.")
    expect(message(multiple, 11)).toBe("At most 10.")
    expect(message(multiple, 1.25)).toBe("Use at most 1 decimals.")
    expect(multiple.parse(1.5)).toBe(1.5)
  })
})

describe("party", () => {
  const party = field.party(common)

  it("names its parts", () => {
    expect(party.subfields).toEqual({
      company: "Company",
      name: "Name",
      title: "Title",
      email: "Email",
      address: "Address",
    })
  })

  it("asks for somewhere to send notices, at the email", () => {
    expect(
      problem(party.schema, { company: "Acme", name: "Ana", title: "CEO" })
    ).toEqual({
      path: ["email"],
      message: "Add an email or a postal address for notices.",
    })
  })

  it("is shown by its company", () => {
    expect(
      party.format({
        company: "Acme",
        name: "Ana",
        title: "CEO",
        email: "ana@acme.test",
      })
    ).toBe("Acme")
  })
})

describe("group and list", () => {
  const text = field.text(common)

  it("say how many parts or rows they need", () => {
    const part = field.text({ ...common, optional: true })
    const one = field.group({ ...common, parts: { a: part, b: part }, min: 1 })
    const two = field.group({ ...common, parts: { a: part, b: part }, min: 2 })
    expect(message(one.schema, {})).toBe("Fill in at least one.")
    expect(message(two.schema, { a: "x" })).toBe("Fill in at least 2.")

    const rows = field.list({ ...common, item: { name: text }, max: 2 })
    const pairs = field.list({ ...common, item: { name: text }, min: 2 })
    expect(message(rows.schema, [])).toBe("Add at least one.")
    expect(message(pairs.schema, [{ name: "x" }])).toBe("Add at least 2.")
    expect(
      message(
        rows.schema,
        [1, 2, 3].map(() => ({ name: "x" }))
      )
    ).toBe("At most 2.")
  })

  it("lets a draft list have no rows yet", () => {
    const rows = field.list({ ...common, item: { name: text } })
    expect(rows.draftSchema.parse([])).toEqual([])
  })

  it("names a list's columns", () => {
    const rows = field.list({ ...common, item: { name: text } })
    expect(rows.columns).toEqual({ name: "Label" })
  })

  it("rejects a bad default when the field is built", () => {
    expect(() =>
      field.list({
        ...common,
        item: { name: text },
        default: [{ name: 1 }] as never,
      })
    ).toThrow('Field "Label": its default is not a valid value.')
  })
})
