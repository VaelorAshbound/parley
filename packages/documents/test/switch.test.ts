import { describe, expect, it } from "vite-plus/test"

import { definitions } from "../src/definitions/index.ts"
import { initialValues, switchDocument } from "../src/define.ts"

// Changing a draft's agreement (T17: the chat may pick another one). What
// still fits is kept; everything else starts from the new document's
// defaults, as a new draft would.

const today = "2026-09-25"
const { csa, sla, dpa } = definitions

describe("switchDocument", () => {
  it("keeps the values whose field the new document has, when they fit", () => {
    const provider = { company: "Acme Cloud, Inc.", name: "Ana Diaz" }
    const customer = { company: "Bolt Retail LLC" }

    const values = switchDocument(
      csa.draftSchema.parse({ provider, customer }),
      sla,
      {
        today,
      }
    )

    expect(values).toMatchObject({ provider, customer })
  })

  it("starts every other field from the new document's defaults", () => {
    const fresh = switchDocument({}, dpa, { today })

    expect(fresh).toEqual(initialValues(dpa, { today }))
  })

  it("drops a value the new document shapes differently", () => {
    // The CSA's governing law is a jurisdiction; the DPA's is a choice.
    const governingLaw = { state: "DE", courtLocation: "New Castle" }

    const values = switchDocument(
      csa.draftSchema.parse({ governingLaw }),
      dpa,
      {
        today,
      }
    )

    expect(values.governingLaw).not.toEqual(governingLaw)
  })

  it("drops a value that would break one of the new document's rules", () => {
    const nda = definitions["mutual-nda"]
    const same = { company: "Acme" }

    // Kept one at a time, the second party would clash with the first.
    const values = switchDocument({ party1: same, party2: same }, nda, {
      today,
    })

    expect(values).toMatchObject({ party1: same })
    expect(values).not.toHaveProperty("party2")
  })

  it("drops a field the new document doesn't have", () => {
    const values = switchDocument({ purpose: "Hiring." }, sla, { today })

    expect(values).not.toHaveProperty("purpose")
  })
})
