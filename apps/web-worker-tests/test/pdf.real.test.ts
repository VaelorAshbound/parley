import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { definitions, render } from "@workspace/documents"
import { toPrintHtml } from "@workspace/documents/print"

// Real Browser Run: turns the engine's print HTML into a PDF. It costs a few
// seconds of browser time, so it runs only in `pnpm test:workers:real`.
describe("the print HTML through real Browser Run", () => {
  it("becomes a complete multi-page PDF", { timeout: 60_000 }, async () => {
    const nda = definitions["mutual-nda"]
    const html = toPrintHtml(render(nda, {}))

    const response = await env.BROWSER.quickAction("pdf", {
      html,
      // Drafts are private: never keep them in Browser Run's cache.
      cacheTTL: 0,
      // The page size and margins come from the print CSS's @page rule.
      pdfOptions: {
        preferCSSPageSize: true,
        printBackground: true,
        tagged: true,
      },
    })

    expect(response.status).toBe(200)
    const pdf = new TextDecoder("latin1").decode(await response.arrayBuffer())
    expect(pdf.startsWith("%PDF-")).toBe(true)
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true)
    expect(
      (pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).length
    ).toBeGreaterThanOrEqual(3)
  })
})
