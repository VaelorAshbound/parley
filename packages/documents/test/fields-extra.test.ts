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
    expect(party.subfields.notice).toBe("Notice address")
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
