import {
  applyFieldChanges,
  definitions,
  field,
  type AnyField,
  type DocumentDefinition,
} from "@workspace/documents"
import { describe, expect, it } from "vite-plus/test"

// The shared, fully filled example of each document (packages/documents).
import { registered } from "../../../../../packages/documents/test/examples"
import { changeOf, draftOf, inputFor, inputsOf } from "./model"

const nda = definitions["mutual-nda"]

/** What `updateFields` makes of one form: the field's new draft value. */
function save(
  definition: DocumentDefinition,
  key: string,
  inputs: Record<string, string>,
  values: Record<string, unknown> = {}
) {
  const fieldOf = definition.fields[key]
  if (!fieldOf) throw new Error(`No field ${key}`)
  return applyFieldChanges(definition, values, [
    { key, value: changeOf(fieldOf, inputs, key) },
  ])
}

describe("every field of every document", () => {
  it.each(registered)(
    "$id: the form gives back exactly the example's values",
    ({ definition, example }) => {
      const values: Record<string, unknown> =
        definition.draftSchema.parse(example)
      const read: Record<string, unknown> = {}
      const rejected = []
      for (const [key, value] of Object.entries(values)) {
        const fieldOf = definition.fields[key] as AnyField
        const inputs = inputsOf(fieldOf, value, key)
        read[key] = draftOf(fieldOf, inputs, key)
        rejected.push(...save(definition, key, inputs, values).rejected)
      }

      expect(read).toEqual(values)
      expect(rejected).toEqual([])
    }
  )

  it.each(registered)(
    "$id: an empty form leaves every field empty",
    ({ definition }) => {
      const read = Object.entries(definition.fields).map(([key, fieldOf]) => {
        const inputs = inputsOf(fieldOf, undefined, key)
        return [
          key,
          draftOf(fieldOf, inputs, key),
          changeOf(fieldOf, inputs, key),
        ]
      })

      expect(read).toEqual(
        Object.keys(definition.fields).map((key) => [key, undefined, null])
      )
    }
  )
})

describe("inputs", () => {
  it("names each input after the field and its parts", () => {
    expect(
      inputsOf(
        nda.fields.party1,
        { company: "Acme", email: "a@acme.test" },
        "party1"
      )
    ).toEqual({
      "party1/company": "Acme",
      "party1/name": "",
      "party1/title": "",
      "party1/email": "a@acme.test",
      "party1/address": "",
    })
  })

  it("keeps a choice's blanks per option, so switching back keeps them", () => {
    const inputs = inputsOf(
      nda.fields.mndaTerm,
      { option: "expires", value: { amount: 2, unit: "years" } },
      "mndaTerm"
    )

    expect(inputs).toMatchObject({
      mndaTerm: "expires",
      "mndaTerm/expires/value/amount": "2",
      "mndaTerm/expires/value/unit": "years",
    })
    expect(
      draftOf(
        nda.fields.mndaTerm,
        { ...inputs, mndaTerm: "untilTerminated" },
        "mndaTerm"
      )
    ).toEqual({ option: "untilTerminated" })
  })
})

describe("draft values", () => {
  const amount = field.number({ label: "Multiple", help: "How many." })
  const fees = field.money({ label: "Fees", help: "What it costs." })

  it.each([
    ["12", 12],
    [" 1.5 ", 1.5],
    ["", undefined],
    // Left as text, so the engine says "Use a number".
    ["twelve", "twelve"],
  ])("reads the number box %j as %j", (text, value) => {
    expect(draftOf(amount, { n: text }, "n")).toBe(value)
  })

  it("reads money with an upper-case currency, and none without an amount", () => {
    expect(
      draftOf(fees, { "f/amount": "1200", "f/currency": " usd " }, "f")
    ).toEqual({ amount: 1200, currency: "USD" })
    expect(
      draftOf(fees, { "f/amount": "", "f/currency": "USD" }, "f")
    ).toBeUndefined()
  })

  it("takes the Other answer of a choice", () => {
    const pick = field.choice({
      label: "Payment",
      help: "How.",
      allowOther: true,
      options: { card: { label: "Card" } },
    })

    expect(draftOf(pick, { p: "other", "p/@other/text": "Wire" }, "p")).toEqual(
      { option: "other", text: "Wire" }
    )
  })

  it("takes the ticked options of a multi-select, in their order", () => {
    const methods = field.choices({
      label: "Methods",
      help: "How.",
      allowOther: true,
      options: { card: { label: "Card" }, ach: { label: "ACH" } },
    })

    expect(
      draftOf(
        methods,
        {
          "m/ach": "on",
          "m/card": "on",
          "m/@other": "on",
          "m/@other/text": "Wire",
        },
        "m"
      )
    ).toEqual({
      selected: [{ option: "card" }, { option: "ach" }],
      other: "Wire",
    })
  })

  it("reads a list's rows, and drops the empty ones", () => {
    const vendors = field.list({
      label: "Vendors",
      help: "Who.",
      item: {
        name: field.text({ label: "Name", help: "Who." }),
        share: field.percent({ label: "Share", help: "How much." }),
      },
    })

    expect(
      draftOf(
        vendors,
        {
          "v/#": "3",
          "v/0/name": "AWS",
          "v/0/share": "",
          "v/1/name": "",
          "v/1/share": "",
          "v/2/name": "Stripe",
          "v/2/share": "5",
        },
        "v"
      )
    ).toEqual([{ name: "AWS" }, { name: "Stripe", share: 5 }])
  })

  it("keeps only the kind of place picked for a jurisdiction", () => {
    const law = field.jurisdiction({ label: "Law", help: "Whose." })
    const inputs = {
      "l/@place": "world",
      "l/state": "DE",
      "l/region": "Ontario, Canada",
      "l/courtLocation": "Toronto",
    }

    expect(draftOf(law, inputs, "l")).toEqual({
      region: "Ontario, Canada",
      courtLocation: "Toronto",
    })
    expect(changeOf(law, inputs, "l")).toEqual({
      state: null,
      region: "Ontario, Canada",
      courtLocation: "Toronto",
    })
  })
})

describe("changes", () => {
  it("clears a text field that was emptied", () => {
    expect(
      changeOf(nda.fields.purpose, { purpose: "  " }, "purpose")
    ).toBeNull()
  })

  it("sends every part of a party, with null for the empty ones", () => {
    const inputs = inputsOf(
      nda.fields.party1,
      { company: "Acme", name: "Ana" },
      "party1"
    )

    expect(
      changeOf(nda.fields.party1, { ...inputs, "party1/name": "" }, "party1")
    ).toEqual({
      company: "Acme",
      name: null,
      title: null,
      email: null,
      address: null,
    })
  })
})

describe("where an error shows", () => {
  it("puts a part's error on that part's input", () => {
    const inputs = inputsOf(
      nda.fields.party1,
      { email: "ana at acme" },
      "party1"
    )
    const [issue] = save(nda, "party1", inputs).rejected[0]?.issues ?? []

    expect(
      issue && inputFor(nda.fields.party1, issue.path, "party1", inputs)
    ).toBe("party1/email")
  })

  it("puts a blank's error on the blank inside the picked option", () => {
    const inputs = {
      mndaTerm: "expires",
      "mndaTerm/expires/value/amount": "0",
      "mndaTerm/expires/value/unit": "years",
    }
    const [issue] = save(nda, "mndaTerm", inputs).rejected[0]?.issues ?? []

    expect(
      issue && inputFor(nda.fields.mndaTerm, issue.path, "mndaTerm", inputs)
    ).toBe("mndaTerm/expires/value/amount")
  })

  it("puts a rule about the whole field on the field itself", () => {
    const inputs = inputsOf(nda.fields.party2, { company: "Acme" }, "party2")
    const [issue] =
      save(nda, "party2", inputs, { party1: { company: "Acme" } }).rejected[0]
        ?.issues ?? []

    expect(issue?.message).toBe("The two parties must be different companies.")
    expect(
      issue && inputFor(nda.fields.party2, issue.path, "party2", inputs)
    ).toBe("party2")
  })

  it("puts a list cell's error on that cell", () => {
    const tiers = field.list({
      label: "Tiers",
      help: "Credits.",
      item: { credit: field.percent({ label: "Credit", help: "How much." }) },
    })

    expect(inputFor(tiers, [1, "credit"], "t", { "t/#": "2" })).toBe(
      "t/1/credit"
    )
    expect(inputFor(tiers, [], "t", {})).toBe("t")
  })

  it("puts a multi-select's blank error on the blank of that option", () => {
    const caps = field.choices({
      label: "Caps",
      help: "Which.",
      options: {
        none: { label: "None" },
        fixed: {
          label: "Up to {value}",
          with: field.money({ label: "Cap", help: "How much." }),
        },
      },
    })
    const inputs = { "c/fixed": "on", "c/fixed/value/amount": "-1" }

    expect(
      inputFor(caps, ["selected", 0, "value", "amount"], "c", inputs)
    ).toBe("c/fixed/value/amount")
    expect(inputFor(caps, ["selected"], "c", inputs)).toBe("c")
  })
})
