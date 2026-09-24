import JSZip from "jszip"
import { describe, expect, it } from "vite-plus/test"

import { definitions } from "../src/definitions/index.ts"
import { readTemplate } from "../src/parse/catalog.ts"
import { parseStandardTerms } from "../src/parse/parse.ts"
import { toDocx } from "../src/output/docx.ts"
import { render } from "../src/render.ts"
import { examples } from "./examples.ts"
import { annexDocument } from "./fixtures.ts"

const nda = definitions["mutual-nda"]
const filled = render(nda, nda.schema.parse(examples["mutual-nda"]))

async function unzip(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer)
  const read = async (name: string) =>
    (await zip.file(name)?.async("string")) ?? ""
  return {
    document: await read("word/document.xml"),
    footer: await read("word/footer1.xml"),
    core: await read("docProps/core.xml"),
  }
}

/** The text of a WordprocessingML part, one paragraph per line. */
function textOf(xml: string) {
  return xml
    .replaceAll(/<w:p[ >]/g, "\n$&")
    .replaceAll(/<w:br\/>/g, "\n")
    .replaceAll(/<w:tab\/>/g, "\t")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

describe("toDocx", () => {
  it("is a Word file titled after the document", async () => {
    const { core } = await unzip(await toDocx(filled))

    expect(core).toContain(
      "<dc:title>Mutual Non-Disclosure Agreement</dc:title>"
    )
  })

  it("uses real headings for the titles and sections", async () => {
    const { document } = await unzip(await toDocx(filled))

    expect(document).toMatch(
      /<w:pStyle w:val="Heading1"\/>.*?<w:t[^>]*>Mutual Non-Disclosure Agreement</
    )
    expect(document).toMatch(
      /<w:pStyle w:val="Heading1"\/>.*?<w:t[^>]*>Standard Terms</
    )
  })

  it("holds every word of the standard terms, with the clause numbers", async () => {
    const text = textOf((await unzip(await toDocx(filled))).document)

    expect(text).toContain(
      "3. Exceptions. The Receiving Party’s obligations in this MNDA do not apply"
    )
    expect(text).toContain(
      "Common Paper Mutual Non-Disclosure Agreement Version 1.0 free to use under CC BY 4.0."
    )
  })

  it("lays the cover page out in a table, and signs in another", async () => {
    const { document } = await unzip(await toDocx(filled))

    expect(document.match(/<w:tbl>/g)).toHaveLength(2)
  })

  it("prints values, placeholders and checkboxes", async () => {
    const text = textOf((await unzip(await toDocx(filled))).document)
    const empty = textOf((await unzip(await toDocx(render(nda, {})))).document)

    expect(text).toContain("☒ Expires 2 years from Effective Date.")
    expect(text).toContain("☐ In perpetuity.")
    expect(text).toContain("Acme Analytics, Inc.")
    expect(empty).toContain("[Purpose]")
  })

  it("keeps line breaks in long answers", async () => {
    const text = textOf(
      (
        await unzip(
          await toDocx(
            render(nda, { modifications: "First change.\nSecond change." })
          )
        )
      ).document
    )

    expect(text).toContain("First change.\nSecond change.")
  })

  it("escapes what people and the AI typed", async () => {
    const { document } = await unzip(
      await toDocx(render(nda, { purpose: "<w:t>injected</w:t> & more" }))
    )

    expect(document).toContain("&lt;w:t&gt;injected&lt;/w:t&gt; &amp; more")
  })

  it("prints US Letter by default and A4 on request", async () => {
    const letter = (await unzip(await toDocx(filled))).document
    const a4 = (await unzip(await toDocx(filled, { pageSize: "A4" }))).document

    expect(letter).toContain('w:w="12240" w:h="15840"')
    expect(a4).toContain('w:w="11906" w:h="16838"')
  })

  it("numbers the pages in the footer", async () => {
    const { footer } = await unzip(await toDocx(filled))

    expect(textOf(footer)).toContain("Mutual Non-Disclosure Agreement\tPage ")
    expect(footer).toContain("PAGE")
    expect(footer).toContain("NUMPAGES")
  })

  it("prints sectioned terms with nested clauses, a bare cover page and no signers", async () => {
    const csa = { ...nda, template: parseStandardTerms(readTemplate("CSA.md")) }
    const rendered = render(csa, {})
    const { document } = await unzip(
      await toDocx({
        ...rendered,
        coverPage: {
          ...rendered.coverPage,
          subtitle: undefined,
          intro: [[{ type: "hint", value: "Fill in each section." }]],
          signatures: [],
        },
      })
    )
    const text = textOf(document)

    expect(document).toMatch(
      /<w:pStyle w:val="Heading2"\/>.*?<w:t[^>]*>1\. Service</
    )
    expect(text).toContain("5.3 Termination. Either party may terminate")
    expect(text).toContain("a. if the other party fails to cure")
    expect(text).toContain("Fill in each section.")
    expect(text).not.toContain("USING THIS")
    expect(document.match(/<w:tbl>/g)).toHaveLength(1)
  })

  it("prints a list as a table inside the cover page table", async () => {
    const { document } = await unzip(
      await toDocx(
        render(annexDocument(), {
          subprocessors: [{ name: "AWS", country: "United States" }],
        })
      )
    )

    expect(document.match(/<w:tbl>/g)).toHaveLength(2)
    expect(textOf(document)).toContain("Name\nCountry\nAWS\nUnited States")
  })

  it("labels a cover page Parley wrote, and only that one", async () => {
    const label = "Cover page by Parley, not by Common Paper"
    const parley = {
      ...filled,
      coverPage: { ...filled.coverPage, source: "parley" as const },
    }

    expect(textOf((await unzip(await toDocx(filled))).document)).not.toContain(
      label
    )
    expect(textOf((await unzip(await toDocx(parley))).document)).toContain(
      label
    )
  })
})

describe.each(Object.keys(definitions))("%s DOCX", (id) => {
  it("matches the reviewed snapshot of its text", async () => {
    const definition = definitions[id as keyof typeof definitions]
    const example = definition.schema.parse(
      examples[id as keyof typeof examples]
    )
    const { document } = await unzip(await toDocx(render(definition, example)))

    await expect(textOf(document)).toMatchFileSnapshot(
      `__outputs__/${id}.docx.txt`
    )
  })
})
