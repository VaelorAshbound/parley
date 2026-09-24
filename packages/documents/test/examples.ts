import type { DocumentDefinition } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"

// A fully filled example of each document: the definition tests render them,
// and the output tests (T12) snapshot them.
export const examples = {
  "mutual-nda": {
    purpose:
      "Evaluating a possible partnership to resell Acme's analytics product.",
    effectiveDate: "2026-10-01",
    mndaTerm: { option: "expires", value: { amount: 2, unit: "years" } },
    confidentialityTerm: {
      option: "fixed",
      value: { amount: 3, unit: "years" },
    },
    governingLaw: { state: "DE", courtLocation: "New Castle" },
    modifications: "Section 3(d) does not apply to source code.",
    party1: {
      company: "Acme Analytics, Inc.",
      name: "Ana Diaz",
      title: "CEO",
      email: "legal@acme.test",
    },
    party2: {
      company: "Bolt Retail LLC",
      name: "Bo Chen",
      title: "Head of Partnerships",
      address: "100 Market St, San Francisco, CA 94105",
    },
  },
} as const

const byId: Readonly<Record<string, unknown>> = examples

/** Every registered document with its example, for loops over all of them. */
export const registered: {
  id: string
  definition: DocumentDefinition
  example: unknown
}[] = Object.entries(definitions).map(([id, definition]) => ({
  id,
  definition,
  example: byId[id],
}))
