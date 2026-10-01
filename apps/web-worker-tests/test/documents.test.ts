import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { definitions, render } from "@workspace/documents"
import { toDocx } from "@workspace/documents/docx"
import { toPrintHtml } from "@workspace/documents/print"

// The document engine inside workerd, the runtime that will export drafts
// (T24). This is where `new Function` is blocked, so Zod must be jitless.
const nda = definitions["mutual-nda"]
const values = nda.draftSchema.parse({
  purpose: "Evaluating a partnership.",
  effectiveDate: "2026-10-01",
  party1: { company: "Acme, Inc." },
})

describe("the document engine in workerd", () => {
  it("checks values with Zod", () => {
    expect(
      nda.draftSchema.safeParse({ effectiveDate: "2026-02-30" }).success
    ).toBe(false)
  })

  it("builds a DOCX that opens as a Word package", async () => {
    const docx = await toDocx(render(nda, values))
    const zip = await JSZip.loadAsync(docx)
    const document = await zip.file("word/document.xml")?.async("string")

    expect(document).toContain("Mutual Non-Disclosure Agreement")
    expect(document).toContain("Acme, Inc.")
    expect(document).toContain("Use and Protection of Confidential Information")
  })

  it("builds the print HTML", () => {
    const html = toPrintHtml(render(nda, values))

    expect(html).toContain("<title>Mutual Non-Disclosure Agreement</title>")
    expect(html).toContain(
      '<span class="value">Evaluating a partnership.</span>'
    )
  })
})
