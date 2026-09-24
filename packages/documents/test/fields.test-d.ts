import { expectTypeOf, test } from "vite-plus/test"

import { field, type Duration } from "../src/fields.ts"
import type { z } from "../src/zod.ts"

const duration = field.duration({ label: "Term", help: "How long." })
const term = field.choice({
  label: "MNDA term",
  help: "How long the MNDA lasts.",
  options: {
    fixed: { label: "Expires {value} from Effective Date.", with: duration },
    untilTerminated: { label: "Continues until terminated." },
  },
})

test("a choice's value names its options and carries the nested value", () => {
  expectTypeOf<z.infer<typeof term.schema>>().toEqualTypeOf<
    { option: "fixed"; value: Duration } | { option: "untilTerminated" }
  >()
  expectTypeOf<z.infer<typeof term.draftSchema>>().toEqualTypeOf<
    { option: "fixed"; value?: Duration } | { option: "untilTerminated" }
  >()
})

test("an Other answer is typed only when the choice allows it", () => {
  const payment = field.choice({
    label: "Payment",
    help: "How payment works.",
    options: { monthly: { label: "Monthly" } },
    allowOther: true,
  })

  expectTypeOf<z.infer<typeof payment.schema>>().toEqualTypeOf<
    { option: "monthly" } | { option: "other"; text: string }
  >()
})

test("object fields type their parts", () => {
  const party = field.party({ label: "Party 1", help: "The first party." })

  expectTypeOf(party.subfields).toHaveProperty("email")
  expectTypeOf<z.infer<typeof party.draftSchema>>().toEqualTypeOf<{
    company?: string
    name?: string
    title?: string
    email?: string
    address?: string
  }>()
  expectTypeOf(party.formatPath)
    .parameter(1)
    .toEqualTypeOf<"company" | "name" | "title" | "email" | "address">()
})
