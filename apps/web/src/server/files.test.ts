import { definitions } from "@workspace/documents"
import { describe, expect, it } from "vite-plus/test"

import { examples } from "../../../../packages/documents/test/examples"

import {
  browserRunPrinter,
  buildFile,
  fileName,
  PrintFailed,
  type PrintPdf,
} from "./files"
import { FONT_CSS } from "./fonts"

const nda = definitions["mutual-nda"]
const values = nda.draftSchema.parse(examples["mutual-nda"])

describe("fileName", () => {
  it("names the file after the draft and the agreement", () => {
    expect(
      fileName("Bolt deal", "Mutual Non-Disclosure Agreement", "pdf")
    ).toBe("Bolt deal – Mutual Non-Disclosure Agreement.pdf")
  })

  it("says the agreement's name once when the draft has no name of its own", () => {
    expect(
      fileName(
        "Mutual Non-Disclosure Agreement",
        "Mutual Non-Disclosure Agreement",
        "docx"
      )
    ).toBe("Mutual Non-Disclosure Agreement.docx")
  })

  it("leaves out characters a file name can't hold", () => {
    expect(
      fileName('Acme/Bolt: "Q4" <v2>?*|\\', "Pilot Agreement", "pdf")
    ).toBe("Acme Bolt Q4 v2 – Pilot Agreement.pdf")
  })

  it("leaves out control characters and new lines", () => {
    expect(fileName("Bolt\n\tdeal\u0000", "Pilot Agreement", "pdf")).toBe(
      "Bolt deal – Pilot Agreement.pdf"
    )
  })

  it("keeps a name in other scripts", () => {
    expect(fileName("Łódź 合作", "Pilot Agreement", "pdf")).toBe(
      "Łódź 合作 – Pilot Agreement.pdf"
    )
  })

  it("shortens a very long name", () => {
    const name = fileName("a".repeat(300), "Pilot Agreement", "pdf")

    expect(name).toBe(`${"a".repeat(80)} – Pilot Agreement.pdf`)
  })

  it("falls back to the agreement's name when nothing of the title is left", () => {
    expect(fileName(" /// ", "Pilot Agreement", "pdf")).toBe(
      "Pilot Agreement.pdf"
    )
  })
})

describe("FONT_CSS", () => {
  it("embeds both brand fonts, since Browser Run has neither", () => {
    expect(FONT_CSS).toContain('font-family:"Newsreader Variable"')
    expect(FONT_CSS).toContain('font-family:"Instrument Sans Variable"')
    expect(FONT_CSS.match(/url\(data:font\/woff2;base64,/g)).toHaveLength(4)
  })
})

/** A fake Browser Run: answers with the given response, records the call. */
function fakeBrowser(response: () => Response) {
  const calls: { action: string; options: unknown }[] = []
  const browser = {
    quickAction: async (action: string, options: unknown) => {
      calls.push({ action, options })
      return response()
    },
  } as unknown as BrowserRun
  return { browser, calls }
}

describe("browserRunPrinter", () => {
  it("prints the page to a PDF that is never cached", async () => {
    const { browser, calls } = fakeBrowser(
      () =>
        new Response("%PDF-1.7 fake", {
          headers: { "x-browser-ms-used": "210" },
        })
    )

    const printed = await browserRunPrinter(browser)("<p>Hi</p>")

    expect(new TextDecoder().decode(printed.bytes)).toBe("%PDF-1.7 fake")
    expect(printed.browserMs).toBe(210)
    expect(calls).toEqual([
      {
        action: "pdf",
        options: {
          html: "<p>Hi</p>",
          cacheTTL: 0,
          pdfOptions: {
            preferCSSPageSize: true,
            printBackground: true,
            tagged: true,
          },
        },
      },
    ])
  })

  it("fails with Browser Run's status when it can't print", async () => {
    const { browser } = fakeBrowser(
      () => new Response('{"success":false}', { status: 429 })
    )

    const printing = browserRunPrinter(browser)("<p>Hi</p>")

    await expect(printing).rejects.toBeInstanceOf(PrintFailed)
    await expect(printing).rejects.toMatchObject({ status: 429 })
  })
})

describe("buildFile", () => {
  const draft = { title: "Bolt deal", definition: nda, values }

  it("prints the PDF from the print page with the brand fonts", async () => {
    let printedHtml = ""
    const printPdf: PrintPdf = async (html) => {
      printedHtml = html
      return {
        bytes: await new Response("%PDF-1.7").arrayBuffer(),
        browserMs: 5,
      }
    }

    const built = await buildFile("pdf", draft, printPdf)

    expect(built.file.name).toBe(
      "Bolt deal – Mutual Non-Disclosure Agreement.pdf"
    )
    expect(built.file.type).toBe("application/pdf")
    expect(built.browserMs).toBe(5)
    expect(printedHtml).toContain("Acme Analytics, Inc.")
    expect(printedHtml).toContain(FONT_CSS)
  })

  it("builds the Word file without Browser Run", async () => {
    const printPdf: PrintPdf = () => {
      throw new Error("no browser for a Word file")
    }

    const built = await buildFile("docx", draft, printPdf)
    // A Word file is a zip package; the Worker tests read what is inside.
    const magic = new Uint8Array(await built.file.arrayBuffer()).subarray(0, 4)

    expect(built.file.name).toBe(
      "Bolt deal – Mutual Non-Disclosure Agreement.docx"
    )
    expect(built.file.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect([...magic]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})
