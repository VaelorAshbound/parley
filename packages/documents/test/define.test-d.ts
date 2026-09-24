import { expectTypeOf, test } from "vite-plus/test"

import {
  defineDocument,
  type CoverPageLayout,
  type DraftValues,
  type FieldChange,
  type FieldPath,
} from "../src/define.ts"
import { field } from "../src/fields.ts"
import type { StandardTerms } from "../src/parse/schema.ts"
import type { z } from "../src/zod.ts"

const template: StandardTerms = {
  type: "standardTerms",
  title: "T",
  children: [],
}
const fields = {
  purpose: field.longText({ label: "Purpose", help: "Why." }),
  party1: field.party({ label: "Party 1", help: "First." }),
}
type Fields = typeof fields

const layout = {
  source: "parley" as const,
  title: "T",
  intro: [],
  closing: [],
  footer: [],
}

test("field paths reach object parts and nothing else", () => {
  expectTypeOf<FieldPath<Fields>>().toEqualTypeOf<
    | "purpose"
    | "party1"
    | "party1.company"
    | "party1.name"
    | "party1.title"
    | "party1.email"
    | "party1.address"
    | "party1.notice"
  >()

  defineDocument({
    id: "t",
    version: 1,
    name: "T",
    template,
    fields,
    // @ts-expect-error: a path to a part that doesn't exist
    linkedTerms: { Purpose: "purpose.words" },
    coverPage: { ...layout, sections: [], signatures: ["party1"] },
  })
})

test("only party fields can sign", () => {
  expectTypeOf<CoverPageLayout<Fields>["signatures"]>().toEqualTypeOf<
    "party1"[]
  >()

  defineDocument({
    id: "t",
    version: 1,
    name: "T",
    template,
    fields,
    linkedTerms: {},
    // @ts-expect-error: "purpose" is not a party
    coverPage: { ...layout, sections: [], signatures: ["purpose"] },
  })
})

test("a draft and a change are typed per field", () => {
  const definition = defineDocument({
    id: "t",
    version: 1,
    name: "T",
    template,
    fields,
    linkedTerms: {},
    coverPage: { ...layout, sections: [], signatures: ["party1"] },
  })

  expectTypeOf<z.infer<typeof definition.draftSchema>>().toEqualTypeOf<
    DraftValues<Fields>
  >()
  expectTypeOf<DraftValues<Fields>["party1"]>().toEqualTypeOf<
    | {
        company?: string
        name?: string
        title?: string
        email?: string
        address?: string
      }
    | undefined
  >()
  expectTypeOf<{ key: "party1"; value: { title: null } }>().toExtend<
    FieldChange<Fields>
  >()
  expectTypeOf<{ key: "purpose"; value: { title: null } }>().not.toExtend<
    FieldChange<Fields>
  >()
})
