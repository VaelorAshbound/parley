import { describe, expect, it } from "vite-plus/test"

import { definitions } from "../src/definitions/index.ts"
import { readTemplate } from "../src/parse/catalog.ts"
import { parseStandardTerms } from "../src/parse/parse.ts"
import { DISCLAIMER } from "../src/disclaimer.ts"
import { printFrame, toPrintHtml } from "../src/output/html.ts"
import { render } from "../src/render.ts"
import { examples, registered } from "./examples.ts"
import { annexDocument } from "./fixtures.ts"

const nda = definitions["mutual-nda"]
const filled = render(nda, nda.schema.parse(examples["mutual-nda"]))
const empty = render(nda, {})

/** The visible words of an HTML page, tags removed and entities decoded. */
function wordsOf(html: string) {
  return html
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/g, " ")
}

describe("toPrintHtml", () => {
  it("is a complete page named after the document", () => {
    const html = toPrintHtml(filled)

    expect(html).toMatch(/^<!doctype html><html lang="en">/)
    expect(html).toContain("<title>Mutual Non-Disclosure Agreement</title>")
    expect(html).toMatch(/<\/html>$/)
  })

  it("prints every word of the standard terms", () => {
    const words = wordsOf(toPrintHtml(filled))

    expect(words).toContain(
      "The Receiving Party’s obligations in this MNDA do not apply to information that it can demonstrate"
    )
    expect(words).toContain(
      "Common Paper Mutual Non-Disclosure Agreement Version 1.0 free to use under CC BY 4.0"
    )
  })

  it("prints the filled values in ink and the empty ones as [placeholders]", () => {
    const html = toPrintHtml(empty)

    expect(toPrintHtml(filled)).toContain(
      '<span class="value">Acme Analytics, Inc.</span>'
    )
    expect(html).toContain('<span class="value missing">[Purpose]</span>')
  })

  it("prints a choice as ticked and empty boxes, drawn so no font can lack them", () => {
    const html = toPrintHtml(filled)
    const words = wordsOf(html)

    expect(html).toMatch(
      /<p class="line"><svg class="box checked" role="img" aria-label="Selected"[^>]*>.*?<\/svg> Expires /
    )
    expect(html).toMatch(
      /<p class="line unchosen"><svg class="box" role="img" aria-label="Not selected"[^>]*>.*?<\/svg> Continues /
    )
    expect(words).toContain("Expires 2 years from Effective Date.")
  })

  it("keeps the closing attribution with the last clause", () => {
    expect(toPrintHtml(filled)).toMatch(
      /<div class="keep"><div class="clause"><p><span class="number">11\.<\/span>.*<p class="attribution">Common Paper Mutual Non-Disclosure Agreement <a /
    )
  })

  it("prints the numbers and bold lead-ins of clauses", () => {
    const html = toPrintHtml(filled)

    expect(html).toContain('<span class="number">1.</span>')
    expect(html).toContain("<strong>Introduction</strong>")
  })

  it("escapes what people and the AI typed", () => {
    const hostile = render(nda, {
      purpose: '<script>alert("x")</script> & <b>bold</b>',
    })
    const html = toPrintHtml(hostile)

    expect(html).not.toContain("<script>alert")
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;"
    )
  })

  it("keeps line breaks in long answers", () => {
    const html = toPrintHtml(
      render(nda, { modifications: "First change.\nSecond change." })
    )

    expect(html).toContain("First change.<br>Second change.")
  })

  it("signs in a table with a column per party", () => {
    const html = toPrintHtml(filled)

    expect(html).toContain(
      '<th scope="col">Party 1</th><th scope="col">Party 2</th>'
    )
    expect(wordsOf(html)).toContain(
      "Notice Address legal@acme.test 100 Market St, San Francisco, CA 94105"
    )
  })

  it("prints US Letter by default and A4 on request", () => {
    expect(toPrintHtml(filled)).toContain("size: Letter")
    expect(toPrintHtml(filled, { pageSize: "A4" })).toContain("size: A4")
  })

  it("leaves the page margins to the printer's header and footer", () => {
    // Browser Run doesn't draw CSS page margin boxes, and a Chrome that does
    // would print them under printFrame's header and footer, twice (T24).
    expect(toPrintHtml(filled)).not.toMatch(/@(top|bottom)-/)
  })

  it("embeds the fonts it is given, since the PDF browser has none", () => {
    const fontCss = '@font-face { font-family: "Newsreader Variable"; }'

    expect(toPrintHtml(filled, { fontCss })).toContain(fontCss)
  })

  it("prints sectioned terms with no closing line, and no table with no signers", () => {
    const csa = { ...nda, template: parseStandardTerms(readTemplate("CSA.md")) }
    const rendered = render(csa, {})
    const html = toPrintHtml({
      ...rendered,
      coverPage: {
        ...rendered.coverPage,
        signatures: { parties: [], rows: [] },
      },
    })

    expect(html).toContain(
      '<section><h2><span class="number">1.</span> Service</h2>'
    )
    expect(html).not.toContain('class="keep"')
    expect(html).not.toContain("<table")
  })

  it("prints a cover page with no subtitle, and hints inside paragraphs", () => {
    const html = toPrintHtml({
      ...filled,
      coverPage: {
        ...filled.coverPage,
        subtitle: undefined,
        intro: [[{ type: "hint", value: "Fill in each section." }]],
      },
    })

    expect(html).not.toContain('class="subtitle"')
    expect(html).toContain(
      '<p><span class="hint">Fill in each section.</span></p>'
    )
  })

  it("prints a list as a table and a group as a checklist", () => {
    const html = toPrintHtml(
      render(annexDocument(), {
        subprocessors: [{ name: "AWS", country: "United States" }],
        measures: { encryption: "AES-256." },
      })
    )

    expect(html).toContain(
      '<table class="list"><thead><tr><th scope="col">Name</th><th scope="col">Country</th></tr></thead><tbody><tr><td><span class="value">AWS</span></td><td><span class="value">United States</span></td></tr></tbody></table>'
    )
    expect(html).toMatch(
      /<p class="line"><svg class="box checked"[^>]*>.*?<\/svg> <span class="label">Encryption:<\/span> <span class="value">AES-256\.<\/span><\/p>/
    )
  })

  it("can't be broken out of by a document name", () => {
    const html = toPrintHtml({
      ...filled,
      name: 'Deal</title><script>x()</script>"',
    })

    expect(html).not.toContain("<script>")
    expect(html).toContain(
      "<title>Deal&lt;/title&gt;&lt;script&gt;x()&lt;/script&gt;&quot;</title>"
    )
  })

  it("labels a cover page Parley wrote, and only that one", () => {
    const label = "Cover page by Parley, not by Common Paper"
    const parley = {
      ...filled,
      coverPage: {
        ...filled.coverPage,
        source: "parley" as const,
        eyebrow: label,
      },
    }

    expect(toPrintHtml(filled)).not.toContain(label)
    expect(toPrintHtml(parley)).toContain(label)
  })
})

describe.each(registered)("$id print HTML", ({ id, definition, example }) => {
  it("matches the reviewed snapshot", async () => {
    const values = definition.schema.parse(example)

    await expect(toPrintHtml(render(definition, values))).toMatchFileSnapshot(
      `__outputs__/${id}.html`
    )
  })
})

describe("printFrame", () => {
  it("numbers the pages and names the document in the footer", () => {
    const { footer } = printFrame(filled)

    expect(footer).toContain(
      'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'
    )
    expect(footer).toContain("<span>Mutual Non-Disclosure Agreement</span>")
  })

  it("says on every page that it is a demo, not for real agreements", () => {
    expect(printFrame(filled).header).toContain(DISCLAIMER)
  })

  it("escapes the document's name", () => {
    expect(
      printFrame({ ...filled, name: 'Pilot <Agreement> & "Co"' }).footer
    ).toContain("<span>Pilot &lt;Agreement&gt; &amp; &quot;Co&quot;</span>")
  })

  it("gives the text a size and a font, since Chrome's default is too small to read", () => {
    const { header, footer } = printFrame(filled)

    expect(header).toContain("font:8pt Arial")
    expect(footer).toContain("font:8pt Arial")
  })
})
