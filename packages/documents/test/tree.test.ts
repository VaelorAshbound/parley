import { describe, expect, it } from "vite-plus/test"

import { readTemplate } from "../src/parse/catalog.ts"
import { parseStandardTerms } from "../src/parse/parse.ts"
import { clausesOf, linkedTermsOf } from "../src/tree.ts"

describe("clausesOf", () => {
  it("walks clauses inside sections, depth first", () => {
    const sla = parseStandardTerms(readTemplate("sla.md"))
    const ids = [...clausesOf(sla)].map((clause) => clause.id)

    expect(ids.slice(0, 3)).toEqual(["1.1", "1.2", "2.1"])
    expect(ids).toContain("3.2.a")
  })

  it("walks top-level clauses and skips closing paragraphs", () => {
    const nda = parseStandardTerms(readTemplate("Mutual-NDA.md"))

    expect([...clausesOf(nda)].map((clause) => clause.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => String(index + 1))
    )
  })
})

describe("linkedTermsOf", () => {
  it("reads linked terms in closing paragraphs too", () => {
    const tree = parseStandardTerms(
      '# T\n\n1. One\n\nSee <span class="coverpage_link">Purpose</span>.\n'
    )

    expect(linkedTermsOf(tree).map((term) => term.term)).toEqual(["Purpose"])
  })

  it("reads linked terms nested in bold text", () => {
    const tree = parseStandardTerms(
      '# T\n\n1. **Use by <span class="coverpage_link">Customer</span>**\n'
    )

    expect(linkedTermsOf(tree).map((term) => term.term)).toEqual(["Customer"])
  })
})
