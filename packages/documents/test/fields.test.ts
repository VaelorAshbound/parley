import fc from "fast-check"
import { describe, expect, it } from "vite-plus/test"

import { field } from "../src/fields.ts"
import { z } from "../src/zod.ts"

const duration = field.duration({ label: "Term", help: "How long." })

const kinds = {
  text: field.text({ label: "Company", help: "The legal name." }),
  longText: field.longText({ label: "Purpose", help: "What it is for." }),
  date: field.date({ label: "Effective date", help: "When it starts." }),
  duration,
  money: field.money({ label: "Fees", help: "What it costs." }),
  percent: field.percent({ label: "Target uptime", help: "Promised uptime." }),
  choice: field.choice({
    label: "MNDA term",
    help: "How long the MNDA lasts.",
    options: {
      fixed: { label: "Expires {value} from Effective Date.", with: duration },
      untilTerminated: { label: "Continues until terminated." },
    },
  }),
  jurisdiction: field.jurisdiction({
    label: "Governing law",
    help: "Whose laws apply.",
  }),
  party: field.party({ label: "Party 1", help: "The first party." }),
}

describe("every field kind", () => {
  it.each(Object.entries(kinds))(
    "%s keeps its label and help in every JSON Schema",
    (_kind, definition) => {
      for (const schema of [
        definition.schema,
        definition.draftSchema,
        definition.changeSchema,
      ]) {
        expect(z.toJSONSchema(schema, { io: "input" })).toMatchObject({
          title: definition.label,
          description: definition.help,
        })
      }
    }
  )
})

describe("text", () => {
  const company = kinds.text

  it("trims the value", () => {
    expect(company.schema.parse("  Acme, Inc. ")).toBe("Acme, Inc.")
  })

  it.each(["", "   ", "x".repeat(201)])("rejects %j", (value) => {
    expect(company.schema.safeParse(value).success).toBe(false)
  })

  it("formats as the value", () => {
    expect(company.format("Acme, Inc.")).toBe("Acme, Inc.")
  })

  it("never lets a non-empty value through untrimmed", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (value) => {
        const result = company.schema.safeParse(value)
        const trimmed = value.trim()

        expect(result.success ? result.data : null).toBe(trimmed || null)
      })
    )
  })
})

describe("longText", () => {
  it("formats as the value", () => {
    expect(kinds.longText.format("Line one\nLine two")).toBe(
      "Line one\nLine two"
    )
  })

  it("keeps line breaks and allows 2,000 characters", () => {
    const value = `First line\nSecond line${"x".repeat(1970)}`

    expect(kinds.longText.schema.parse(value)).toBe(value)
    expect(kinds.longText.schema.safeParse("x".repeat(2001)).success).toBe(
      false
    )
  })
})

describe("date", () => {
  it.each([
    ["2026-09-24", "September 24, 2026"],
    ["2028-02-29", "February 29, 2028"],
    ["2027-01-01", "January 1, 2027"],
  ])("formats %s as %s in every time zone", (value, text) => {
    expect(kinds.date.schema.parse(value)).toBe(value)
    expect(kinds.date.format(value)).toBe(text)
  })

  it.each(["2026-02-30", "2027-02-29", "24/09/2026", "2026-9-24", ""])(
    "rejects %j",
    (value) => {
      expect(kinds.date.schema.safeParse(value).success).toBe(false)
    }
  )
})

describe("duration", () => {
  it.each([
    [{ amount: 1, unit: "years" }, "1 year"],
    [{ amount: 2, unit: "years" }, "2 years"],
    [{ amount: 30, unit: "days" }, "30 days"],
    [{ amount: 10, unit: "businessDays" }, "10 business days"],
    [{ amount: 1, unit: "businessDays" }, "1 business day"],
    [{ amount: 4, unit: "hours" }, "4 hours"],
    [{ amount: 6, unit: "weeks" }, "6 weeks"],
    [{ amount: 1, unit: "months" }, "1 month"],
  ] as const)("formats %j as %s", (value, text) => {
    expect(duration.format(duration.schema.parse(value))).toBe(text)
  })

  it.each([
    { amount: 0, unit: "years" },
    { amount: 1000, unit: "years" },
    { amount: 1.5, unit: "years" },
    { amount: 1, unit: "decades" },
    { amount: 1 },
  ])("rejects %j", (value) => {
    expect(duration.schema.safeParse(value).success).toBe(false)
  })
})

describe("money", () => {
  const fees = kinds.money

  it.each([
    [{ amount: 1500, currency: "USD" }, "$1,500.00"],
    [{ amount: 1500, currency: "JPY" }, "¥1,500"],
    // ICU puts a no-break space after a currency code.
    [{ amount: 1.125, currency: "KWD" }, "KWD\u00A01.125"],
    [{ amount: 0, currency: "EUR" }, "€0.00"],
  ])("formats %j as %s", (value, text) => {
    expect(fees.format(fees.schema.parse(value))).toBe(text)
  })

  it.each([
    [{ amount: 100.5, currency: "JPY" }, "a yen amount has no decimals"],
    [{ amount: 10.001, currency: "USD" }, "a dollar amount has 2 decimals"],
    [{ amount: -1, currency: "USD" }, "no negative amounts"],
    [{ amount: 1e13, currency: "USD" }, "no absurd amounts"],
    [{ amount: 10, currency: "XYZ" }, "an unknown currency"],
    [{ amount: 10, currency: "usd" }, "a lower-case code"],
  ])("rejects %j: %s", (value) => {
    expect(fees.schema.safeParse(value).success).toBe(false)
  })
})

describe("percent", () => {
  it.each([
    [99.9, "99.9%"],
    [100, "100%"],
    [0, "0%"],
    [99.95, "99.95%"],
  ])("formats %d as %s", (value, text) => {
    expect(kinds.percent.format(kinds.percent.schema.parse(value))).toBe(text)
  })

  it.each([-1, 100.01, 99.999])("rejects %d", (value) => {
    expect(kinds.percent.schema.safeParse(value).success).toBe(false)
  })
})

describe("choice", () => {
  const term = kinds.choice

  it("needs the nested value once complete, but not while drafting", () => {
    expect(term.schema.safeParse({ option: "fixed" }).success).toBe(false)
    expect(term.draftSchema.safeParse({ option: "fixed" }).success).toBe(true)
    expect(
      term.schema.safeParse({
        option: "fixed",
        value: { amount: 1, unit: "years" },
      }).success
    ).toBe(true)
  })

  it("rejects an option it does not have", () => {
    expect(term.draftSchema.safeParse({ option: "forever" }).success).toBe(
      false
    )
  })

  it("fills {value} with the nested value, or its placeholder", () => {
    expect(
      term.format({ option: "fixed", value: { amount: 2, unit: "years" } })
    ).toBe("Expires 2 years from Effective Date.")
    expect(term.format({ option: "fixed" })).toBe(
      "Expires [Term] from Effective Date."
    )
    expect(term.format({ option: "untilTerminated" })).toBe(
      "Continues until terminated."
    )
  })

  it("takes an 'other' answer only when it allows one", () => {
    const withOther = field.choice({
      label: "Payment",
      help: "How payment works.",
      options: { monthly: { label: "Monthly" } },
      allowOther: true,
    })

    expect(
      withOther.schema.parse({ option: "other", text: " Quarterly " })
    ).toEqual({ option: "other", text: "Quarterly" })
    expect(withOther.format({ option: "other", text: "Quarterly" })).toBe(
      "Quarterly"
    )
    expect(
      withOther.schema.safeParse({ option: "other", text: "" }).success
    ).toBe(false)
    expect(term.schema.safeParse({ option: "other", text: "x" }).success).toBe(
      false
    )
  })

  it("replaces the whole choice on a change, and null clears it", () => {
    expect(
      term.merge({ option: "untilTerminated" }, { option: "fixed" })
    ).toEqual({ option: "fixed" })
    expect(term.merge({ option: "fixed" }, null)).toBeUndefined()
  })

  it("shows nothing for an option the document no longer has", () => {
    // An old draft saved before a new version of the document dropped it.
    const stale = { option: "forever" } as unknown as { option: "fixed" }

    expect(term.format(stale)).toBeNull()
  })

  it("refuses an option named 'other', which the Other answer uses", () => {
    expect(() =>
      field.choice({
        label: "Bad",
        help: "Bad.",
        options: { other: { label: "Other" } },
      })
    ).toThrow("other")
  })
})

describe("jurisdiction", () => {
  const law = kinds.jurisdiction
  const delaware = { state: "DE", courtLocation: "New Castle" } as const

  it("formats the state and the courts", () => {
    expect(law.format(delaware)).toBe("Delaware")
    expect(law.formatPath(delaware, "state")).toBe("Delaware")
    expect(law.formatPath(delaware, "courtLocation")).toBe(
      "courts located in New Castle, DE"
    )
  })

  it("puts the courts in the governing-law state, so they always match", () => {
    expect(
      law.formatPath({ courtLocation: "New Castle" }, "courtLocation")
    ).toBeNull()
    expect(law.format({ courtLocation: "New Castle" })).toBeNull()
  })

  it("accepts the 50 states and DC, and nothing else", () => {
    expect(law.schema.safeParse({ ...delaware, state: "DC" }).success).toBe(
      true
    )
    expect(law.schema.safeParse({ ...delaware, state: "XX" }).success).toBe(
      false
    )
  })

  it("shows no courts until their location is set", () => {
    expect(law.formatPath({ state: "DE" }, "courtLocation")).toBeNull()
  })

  it("allows a half-filled value while drafting", () => {
    expect(law.draftSchema.safeParse({ state: "DE" }).success).toBe(true)
    expect(law.schema.safeParse({ state: "DE" }).success).toBe(false)
  })
})

describe("party", () => {
  const party = kinds.party
  const acme = {
    company: "Acme, Inc.",
    name: "Ana Diaz",
    title: "CEO",
    email: "ana@acme.test",
  }

  it("needs company, name, title and an email or an address", () => {
    const { email: _email, ...noContact } = acme

    expect(party.schema.safeParse(acme).success).toBe(true)
    expect(
      party.schema.safeParse({ ...noContact, address: "1 Main St" }).success
    ).toBe(true)
    expect(party.schema.safeParse(noContact).success).toBe(false)
  })

  it("rejects an email that is not one", () => {
    expect(party.draftSchema.safeParse({ email: "ana at acme" }).success).toBe(
      false
    )
  })

  it("formats as the company, and each part on its own", () => {
    expect(party.format(acme)).toBe("Acme, Inc.")
    expect(party.format({ name: "Ana Diaz" })).toBeNull()
    expect(party.formatPath(acme, "email")).toBe("ana@acme.test")
    expect(party.formatPath(acme, "address")).toBeNull()
  })

  it("names each part for placeholders and forms", () => {
    expect(party.subfields).toEqual({
      company: "Company",
      name: "Name",
      title: "Title",
      email: "Email",
      address: "Address",
      notice: "Notice address",
    })
  })
})

describe("merge", () => {
  it("replaces a plain value, and null clears it", () => {
    expect(kinds.text.merge("Old", "New")).toBe("New")
    expect(kinds.text.merge("Old", null)).toBeUndefined()
  })

  it("merges a part of an object value, and a null part removes it", () => {
    const party = kinds.party

    expect(
      party.merge(
        { company: "Acme", name: "Ana" },
        { title: "CEO", name: null }
      )
    ).toEqual({ company: "Acme", title: "CEO" })
    expect(party.merge(undefined, { company: "Acme" })).toEqual({
      company: "Acme",
    })
  })

  it("treats an object with no parts left as cleared", () => {
    expect(
      kinds.party.merge({ company: "Acme" }, { company: null })
    ).toBeUndefined()
    expect(kinds.party.merge({ company: "Acme" }, null)).toBeUndefined()
  })

  it("accepts null parts in a change, which the draft value never holds", () => {
    expect(
      kinds.party.changeSchema.safeParse({ title: null, company: "Acme" })
        .success
    ).toBe(true)
    expect(kinds.party.draftSchema.safeParse({ title: null }).success).toBe(
      false
    )
  })
})
