import { describe, expect, it } from "vite-plus/test"

import { EU_MEMBER_STATES, field } from "../src/fields.ts"
import { z } from "../src/zod.ts"

// The kinds added in T7b, for mirroring Common Paper's official cover pages.

describe("duration units", () => {
  const any = field.duration({ label: "Term", help: "How long." })

  it.each([
    [{ amount: 30, unit: "minutes" }, "30 minutes"],
    [{ amount: 1, unit: "quarters" }, "1 quarter"],
    [{ amount: 60, unit: "calendarDays" }, "60 calendar days"],
  ] as const)("formats %j as %s", (value, text) => {
    expect(any.format(any.schema.parse(value))).toBe(text)
  })

  it("can be limited to some units", () => {
    const breach = field.duration({
      label: "Breach notification period",
      help: "How soon a breach is reported.",
      units: ["hours", "businessDays", "calendarDays"],
    })

    expect(
      breach.schema.safeParse({ amount: 5, unit: "businessDays" }).success
    ).toBe(true)
    expect(breach.schema.safeParse({ amount: 5, unit: "years" }).success).toBe(
      false
    )
    expect(JSON.stringify(z.toJSONSchema(breach.schema))).toContain(
      '"enum":["hours","businessDays","calendarDays"]'
    )
  })
})

describe("percent decimals", () => {
  it("allows 3 decimals when asked, for 99.999% uptime", () => {
    const uptime = field.percent({
      label: "Target uptime",
      help: "Promised uptime.",
      decimals: 3,
    })

    expect(uptime.format(uptime.schema.parse(99.999))).toBe("99.999%")
    expect(uptime.schema.safeParse(99.9999).success).toBe(false)
  })
})

describe("number", () => {
  const multiple = field.number({
    label: "Multiple",
    help: "How many times the fees.",
    min: 0.5,
    max: 100,
    decimals: 1,
  })

  it.each([
    [2, "2"],
    [1.5, "1.5"],
  ])("formats %d as %s", (value, text) => {
    expect(multiple.format(multiple.schema.parse(value))).toBe(text)
  })

  it.each([0.4, 101, 1.25, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %d",
    (value) => {
      expect(multiple.schema.safeParse(value).success).toBe(false)
    }
  )

  it("starts at zero when no minimum is given", () => {
    const count = field.number({ label: "Count", help: "How many." })

    expect(count.schema.safeParse(0).success).toBe(true)
    expect(count.schema.safeParse(-1).success).toBe(false)
  })

  it("allows whole numbers only by default", () => {
    const sessions = field.number({
      label: "Sessions",
      help: "How many.",
      min: 1,
    })

    expect(sessions.schema.safeParse(3).success).toBe(true)
    expect(sessions.schema.safeParse(2.5).success).toBe(false)
  })
})

describe("select", () => {
  const state = field.select({
    label: "Governing member state",
    help: "The EU country whose law governs.",
    options: EU_MEMBER_STATES,
  })

  it("stores the code and shows the name", () => {
    expect(state.schema.parse("IE")).toBe("IE")
    expect(state.format("IE")).toBe("Ireland")
  })

  it("shows nothing for a code the list no longer has", () => {
    // An old draft saved before a later version dropped the option.
    expect(state.format("XX" as "IE")).toBeNull()
  })

  it("lists the 27 EU member states", () => {
    expect(Object.keys(EU_MEMBER_STATES)).toHaveLength(27)
    expect(state.schema.safeParse("GB").success).toBe(false)
  })

  it("offers its options to the AI tools by name", () => {
    const json = JSON.stringify(z.toJSONSchema(state.schema))

    expect(json).toContain('"IE"')
    expect(json).toContain("The EU country whose law governs.")
  })
})

describe("url", () => {
  const policy = field.url({
    label: "Security policy",
    help: "Where it lives.",
  })

  it("takes an https link", () => {
    expect(policy.schema.parse("https://acme.test/security")).toBe(
      "https://acme.test/security"
    )
    expect(policy.format("https://acme.test/security")).toBe(
      "https://acme.test/security"
    )
  })

  it.each(["http://acme.test", "javascript:alert(1)", "acme.test", ""])(
    "rejects %j",
    (value) => {
      expect(policy.schema.safeParse(value).success).toBe(false)
    }
  )
})

describe("a party's notice address", () => {
  const party = field.party({ label: "Customer", help: "The customer." })

  it("reads the email and the postal address, whichever are set", () => {
    expect(party.formatPath({ email: "a@acme.test" }, "notice")).toBe(
      "a@acme.test"
    )
    expect(
      party.formatPath({ email: "a@acme.test", address: "1 Main St" }, "notice")
    ).toBe("a@acme.test\n1 Main St")
    expect(party.formatPath({ company: "Acme" }, "notice")).toBeNull()
  })

  it("is a path to read, never a part to store or change", () => {
    expect(party.derived.notice).toBe("Notice address")
    expect(party.draftSchema.safeParse({ notice: "x" }).success).toBe(false)
    expect(party.changeSchema.safeParse({ notice: "x" }).success).toBe(false)
  })
})

describe("jurisdiction outside the US", () => {
  const law = field.jurisdiction({
    label: "Governing law",
    help: "Whose laws.",
  })
  const ontario = { region: "Ontario, Canada", courtLocation: "Toronto" }

  it("takes a province or country, with courts in the same place", () => {
    expect(law.schema.parse(ontario)).toEqual(ontario)
    expect(law.format(ontario)).toBe("Ontario, Canada")
    expect(law.formatPath(ontario, "region")).toBe("Ontario, Canada")
    expect(law.formatPath(ontario, "courtLocation")).toBe(
      "courts located in Toronto, Ontario, Canada"
    )
    expect(law.formatPath(ontario, "state")).toBeNull()
  })

  it("needs exactly one place once complete, and at most one while drafting", () => {
    const both = { ...ontario, state: "DE" }

    expect(law.schema.safeParse(both).success).toBe(false)
    expect(law.schema.safeParse({ courtLocation: "Toronto" }).success).toBe(
      false
    )
    expect(law.draftSchema.safeParse(both).success).toBe(false)
    expect(
      law.draftSchema.safeParse({ courtLocation: "Toronto" }).success
    ).toBe(true)
  })

  it("swaps the place when a change picks the other kind", () => {
    expect(
      law.merge(
        { state: "DE", courtLocation: "Dover" },
        { region: "Ontario, Canada" }
      )
    ).toEqual({ region: "Ontario, Canada", courtLocation: "Dover" })
    expect(law.merge(ontario, { state: "NY" })).toEqual({
      state: "NY",
      courtLocation: "Toronto",
    })
  })

  it("keeps the place when a change names only the courts, and null clears it", () => {
    expect(law.merge(ontario, { courtLocation: "Ottawa" })).toEqual({
      region: "Ontario, Canada",
      courtLocation: "Ottawa",
    })
    expect(law.merge(ontario, null)).toBeUndefined()
  })

  it("stays US-only where the terms say 'the State of'", () => {
    const usOnly = field.jurisdiction({
      label: "Governing law",
      help: "Whose laws.",
      usOnly: true,
    })

    expect(
      usOnly.draftSchema.safeParse({ region: "Ontario, Canada" }).success
    ).toBe(false)
    expect(
      usOnly.changeSchema.safeParse({ region: "Ontario, Canada" }).success
    ).toBe(false)
    expect(usOnly.subfields).toEqual({
      state: "State",
      courtLocation: "Courts",
    })
    expect(usOnly.format({ state: "DE" })).toBe("Delaware")
    expect(usOnly.format({ courtLocation: "Dover" })).toBeNull()
    expect(usOnly.formatPath({ courtLocation: "Dover" }, "state")).toBeNull()
  })

  it("shows no region until one is set", () => {
    expect(law.formatPath({ state: "DE" }, "region")).toBeNull()
  })
})

// --- Fixes from the T7b design review ---

describe("derived parts", () => {
  it("are listed apart from the parts a form edits", () => {
    const party = field.party({ label: "Customer", help: "The customer." })

    expect(Object.keys(party.subfields)).not.toContain("notice")
    expect(party.derived).toEqual({ notice: "Notice address" })
  })
})

describe("decimals", () => {
  it("count exactly, with no float tolerance", () => {
    const whole = field.number({ label: "Count", help: "How many." })
    const uptime = field.percent({ label: "Uptime", help: "Up.", decimals: 3 })

    expect(whole.schema.safeParse(1.0000001).success).toBe(false)
    expect(uptime.schema.safeParse(99.9991).success).toBe(false)
    expect(uptime.schema.safeParse(99.999).success).toBe(true)
  })
})

describe("number above a floor", () => {
  it("can exclude the minimum, for 'more than 1x the fees'", () => {
    const cap = field.number({
      label: "Multiple",
      help: "Times the fees.",
      min: 1,
      minExclusive: true,
      decimals: 2,
    })

    expect(cap.schema.safeParse(1).success).toBe(false)
    expect(cap.schema.safeParse(1.5).success).toBe(true)
  })
})

describe("url, strictly", () => {
  const policy = field.url({
    label: "Security policy",
    help: "Where it lives.",
  })

  it.each([
    "https:acme.test",
    "https://user:secret@acme.test/policy",
    `https://acme.test/${"x".repeat(500)}`,
  ])("rejects %j", (value) => {
    expect(policy.schema.safeParse(value).success).toBe(false)
  })
})

describe("defaults", () => {
  it("must be valid values, checked when the field is defined", () => {
    expect(() =>
      field.duration({
        label: "Term",
        help: "How long.",
        units: ["months", "years"],
        default: { amount: 30, unit: "days" },
      })
    ).toThrow('Field "Term": its default is not a valid value.')
  })
})

describe("courts anywhere", () => {
  it("prints the courts as given, for terms whose courts may sit elsewhere", () => {
    const law = field.jurisdiction({
      label: "Governing law",
      help: "Whose laws, and which courts.",
      courts: "anywhere",
    })
    const value = {
      state: "DE",
      courtLocation: "New York County, New York",
    } as const

    expect(law.schema.parse(value)).toEqual(value)
    expect(law.formatPath(value, "courtLocation")).toBe(
      "courts located in New York County, New York"
    )
  })
})

describe("choice options with several blanks", () => {
  const cap = field.choice({
    label: "General cap amount",
    help: "The most either side pays.",
    options: {
      multiple: {
        label:
          "{value}x the fees paid or payable in the 12 months before the claim",
        with: field.number({
          label: "Multiple",
          help: "Times the fees.",
          decimals: 2,
          min: 1,
        }),
      },
      greater: {
        label:
          "The greater of {amount} or {multiple}x the fees paid or payable in the 12 months before the claim",
        blanks: {
          amount: field.money({ label: "Amount", help: "A fixed floor." }),
          multiple: field.number({
            label: "Multiple",
            help: "Times the fees.",
            decimals: 2,
            min: 1,
          }),
        },
      },
    },
  })

  it("fills each blank, or shows its placeholder", () => {
    expect(
      cap.format({
        option: "greater",
        value: { amount: { amount: 100000, currency: "USD" }, multiple: 2 },
      })
    ).toBe(
      "The greater of $100,000.00 or 2x the fees paid or payable in the 12 months before the claim"
    )
    expect(cap.format({ option: "greater", value: { multiple: 2 } })).toBe(
      "The greater of [Amount] or 2x the fees paid or payable in the 12 months before the claim"
    )
  })

  it("needs every blank once complete, and any of them while drafting", () => {
    expect(
      cap.schema.safeParse({ option: "greater", value: { multiple: 2 } })
        .success
    ).toBe(false)
    expect(
      cap.draftSchema.safeParse({ option: "greater", value: { multiple: 2 } })
        .success
    ).toBe(true)
  })

  it("stores an option with no blanks filled as the option alone", () => {
    expect(cap.merge(undefined, { option: "greater", value: {} })).toEqual({
      option: "greater",
    })
  })

  it.each([
    [
      "a blank with no field",
      { label: "Pay {amount}", blanks: {} },
      "blank {amount} in its label has no field",
    ],
    [
      "a field with no blank",
      {
        label: "Pay now",
        blanks: { amount: field.money({ label: "A", help: "A." }) },
      },
      "blank {amount} is missing from its label",
    ],
    [
      "{value} with no field",
      { label: "Pay {value}" },
      "blank {value} in its label has no field",
    ],
    [
      "a blank used twice",
      {
        label: "Pay {value} and {value}",
        with: field.number({ label: "N", help: "N." }),
      },
      "blank {value} appears twice in its label",
    ],
    [
      "both kinds of blanks",
      {
        label: "Pay {value}",
        with: field.number({ label: "N", help: "N." }),
        blanks: { amount: field.money({ label: "A", help: "A." }) },
      },
      "use with or blanks, not both",
    ],
  ])("refuses an option with %s", (_name, option, message) => {
    expect(() =>
      field.choice({ label: "Bad", help: "Bad.", options: { pay: option } })
    ).toThrow(`Choice "Bad", option "pay": ${message}.`)
  })

  it("takes a draft default that picks an option and leaves its blank empty", () => {
    const term = field.choice({
      label: "SOW term",
      help: "How long the SOW lasts.",
      options: {
        fixed: {
          label: "{value} from the SOW Effective Date",
          with: field.duration({ label: "Length", help: "How long." }),
        },
      },
      default: { option: "fixed" },
    })

    expect(term.default).toEqual({ option: "fixed" })
  })
})

describe("a pick list inside a blank", () => {
  it("fills a blank, like the period in 'Fees per [month | year]'", () => {
    const fees = field.choice({
      label: "Fees",
      help: "What the design partner pays.",
      options: {
        paid: {
          label: "{amount} per {period}",
          blanks: {
            amount: field.money({ label: "Amount", help: "How much." }),
            period: field.select({
              label: "Period",
              help: "How often.",
              options: { month: "month", quarter: "quarter", year: "year" },
            }),
          },
        },
      },
    })

    expect(
      fees.format({
        option: "paid",
        value: { amount: { amount: 500, currency: "USD" }, period: "quarter" },
      })
    ).toBe("$500.00 per quarter")
  })
})
