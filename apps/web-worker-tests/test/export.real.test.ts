import { definitions } from "@workspace/documents"
import { env } from "cloudflare:workers"
import JSZip from "jszip"
import { extractText, getDocumentProxy } from "unpdf"
import { describe, expect, it } from "vitest"

import { examples } from "../../../packages/documents/test/examples"
import { browserRunPrinter, buildFile } from "../../web/src/server/files"

// The files a user downloads (T24), made for real: the PDF by real Browser
// Run, the Word file in workerd. Each is read back with a parser. One print
// per run (a few seconds of browser time); run with `pnpm test:workers:real`.
// No database here, so this never touches Neon.

const nda = definitions["mutual-nda"]
const draft = {
  title: "Bolt partnership",
  definition: nda,
  values: nda.draftSchema.parse(examples["mutual-nda"]),
}

describe("a real export", () => {
  it(
    "prints a PDF with the draft's words and the page numbers",
    {
      timeout: 60_000,
    },
    async () => {
      const { file, browserMs } = await buildFile(
        "pdf",
        draft,
        browserRunPrinter(env.BROWSER)
      )

      const pdf = await getDocumentProxy(
        new Uint8Array(await file.arrayBuffer())
      )
      const { totalPages, text } = await extractText(pdf, { mergePages: true })

      expect(file.name).toBe(
        "Bolt partnership – Mutual Non-Disclosure Agreement.pdf"
      )
      expect(totalPages).toBeGreaterThanOrEqual(3)
      expect(text).toContain("Mutual Non-Disclosure Agreement")
      expect(text).toContain("Bolt Retail LLC")
      expect(text).toContain(`Page 1 of ${totalPages}`)
      // The brand fonts are embedded, not a fallback (T2 found Liberation Serif).
      const fonts = new TextDecoder("latin1").decode(await file.arrayBuffer())
      expect(fonts).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+Newsreader/)
      expect(fonts).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+InstrumentSans/)
      expect(browserMs).toBeGreaterThan(0)
    }
  )

  it("builds a Word file that reads back", async () => {
    const { file } = await buildFile("docx", draft, () => {
      throw new Error("A Word file needs no browser.")
    })

    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const document = await zip.file("word/document.xml")?.async("string")

    expect(file.name).toBe(
      "Bolt partnership – Mutual Non-Disclosure Agreement.docx"
    )
    expect(document).toContain("Bolt Retail LLC")
    expect(document).toContain("Use and Protection of Confidential Information")
  })
})
