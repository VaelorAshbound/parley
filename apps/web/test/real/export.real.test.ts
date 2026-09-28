import {
  DISCLAIMER,
  definitionOf,
  missingFields,
  render,
  type DocumentId,
  type RenderedClause,
  type RenderedDocument,
  type RenderedInline,
} from "@workspace/documents"
import JSZip from "jszip"
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf"
import { describe, expect, inject, test } from "vite-plus/test"
import { commands } from "vite-plus/test/browser"

import { examples } from "../../../../packages/documents/test/examples"

// All 12 documents exported for real (T31): the 11 agreements, the Mutual
// NDA with its official cover page. print.ts made the files (real Browser
// Run); here they are read back like a person would: the words and page
// numbers of each PDF and Word file, and every PDF page as a picture next
// to its approved baseline.

/**
 * Pages per document. A change here is a change people see, so it is
 * approved by hand, like the baselines.
 */
const PAGES: Record<DocumentId, number> = {
  "ai-addendum": 6,
  baa: 7,
  csa: 18,
  "design-partner-agreement": 8,
  dpa: 15,
  "mutual-nda": 4,
  "partnership-agreement": 13,
  "pilot-agreement": 9,
  psa: 18,
  sla: 4,
  "software-license-agreement": 17,
}

/**
 * Text as a reader sees it: one space between words, whatever the layout.
 * - A word the PDF broke after its hyphen ("out-⏎of-pocket") reads whole.
 * - pdf.js reads the kerning gap in "(f)" as a space: "(f )". Only its text
 *   layer; the page looks right, so kerning stays on.
 * - Invisible marks go: Common Paper's DPA has a left-to-right mark in
 *   "Section ‎18", which the PDF doesn't keep.
 */
const words = (text: string) =>
  text
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .replace(/(?<=\w-) (?=\w)/g, "")
    .replace(/(?<=\w) (?=\))/g, "")
    .trim()

/** The words of a run of inline nodes, as printed. */
function textOf(nodes: RenderedInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "hint":
          return node.value
        case "linkedTerm":
          return node.text
        case "strong":
        case "definition":
        case "link":
          return textOf(node.children)
      }
    })
    .join("")
}

/**
 * What a fully filled document must show, each as one phrase: its titles and
 * headings, every paragraph and clause of the standard terms word for word,
 * and every value on its cover page. The eyebrow is left out: CSS writes it
 * in capitals.
 */
function phrasesOf({ coverPage, standardTerms }: RenderedDocument) {
  const clause = (node: RenderedClause): string[] => [
    ...(node.heading ? [node.heading] : []),
    textOf(node.content),
    ...node.children.flatMap(clause),
  ]
  const values = [
    ...coverPage.sections.flatMap((section) => [
      ...section.lines.flatMap((line) =>
        line.parts.flatMap((part) => (part.type === "value" ? [part] : []))
      ),
      ...(section.table?.rows.flat() ?? []),
    ]),
    ...coverPage.signatures.rows.flatMap((row) =>
      row.cells.filter((cell) => cell !== null)
    ),
  ]
  return [
    coverPage.title,
    ...coverPage.intro.map(textOf),
    ...coverPage.sections.map((section) => section.heading),
    ...values.map((value) => value.text ?? ""),
    ...coverPage.closing.map(textOf),
    ...coverPage.footer.map(textOf),
    standardTerms.title,
    ...standardTerms.children.flatMap((block) =>
      block.type === "section"
        ? [block.heading, ...block.children.flatMap(clause)]
        : block.type === "clause"
          ? clause(block)
          : [textOf(block.content)]
    ),
  ]
    .map(words)
    .filter((phrase) => phrase !== "")
}

async function bytesOf(path: string) {
  const base64 = await commands.readFile(path, "base64")
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** The text of a Word part: one paragraph per line, a break as a space. */
function wordText(xml: string) {
  return xml
    .split("</w:p>")
    .map((paragraph) =>
      [
        ...paragraph.matchAll(
          /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:(?:br|tab)(?: [^>]*)?\/>/g
        ),
      ]
        .map(([, text]) => text ?? " ")
        .join("")
    )
    .join("\n")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

describe.for(inject("realExports"))("$id", (made) => {
  const definition = definitionOf(made.id)
  const values = definition.draftSchema.parse(examples[made.id])
  const rendered = render(definition, values)

  test("is fully filled in", () => {
    expect(missingFields(definition, values)).toEqual([])
    // Blanks print only on the options not chosen, as on the official
    // cover pages ("[Other]"); every line that applies has its value.
    const blanks = rendered.coverPage.sections.flatMap((section) => [
      ...section.lines
        .filter((line) => line.checked !== false)
        .flatMap((line) => line.parts),
      ...(section.table?.rows.flat() ?? []).map((value) => ({
        type: "value" as const,
        ...value,
      })),
    ])
    expect(
      blanks.flatMap((part) =>
        part.type === "value" && part.text === null ? [part.placeholder] : []
      )
    ).toEqual([])
  })

  test("prints a PDF with every heading, value and page number", async () => {
    const pdf = await getDocumentProxy(await bytesOf(made.pdf))
    const { totalPages, text } = await extractText(pdf)

    expect(made.pdfName).toBe(`Real export – ${definition.name}.pdf`)
    expect(totalPages).toBe(PAGES[made.id])
    // Chrome's header and footer, on every page.
    const footer = (index: number) =>
      `${rendered.name} Page ${index + 1} of ${totalPages}`
    text.forEach((page, index) => {
      expect(words(page)).toContain(DISCLAIMER)
      expect(words(page)).toContain(footer(index))
    })
    // The body as one text: a sentence that runs onto the next page reads
    // on without the header and footer in between.
    const all = text
      .map((page, index) =>
        words(page).replace(DISCLAIMER, " ").replace(footer(index), " ")
      )
      .join(" ")
    for (const phrase of phrasesOf(rendered))
      expect(words(all)).toContain(phrase)
  })

  test("prints pages that look like the approved ones", async () => {
    const pdf = await getDocumentProxy(await bytesOf(made.pdf))

    for (let number = 1; number <= pdf.numPages; number++) {
      const image = document.createElement("img")
      image.src = await renderPageAsImage(pdf, number, { toDataURL: true })
      document.body.replaceChildren(image)
      await image.decode()

      await expect.element(image).toMatchScreenshot(`${made.id}-page-${number}`)
    }
  })

  test("builds a Word file with every heading and value", async () => {
    const zip = await JSZip.loadAsync(await bytesOf(made.docx))
    const part = async (name: string) =>
      wordText((await zip.file(name)?.async("string")) ?? "")

    expect(made.docxName).toBe(`Real export – ${definition.name}.docx`)
    const all = words(await part("word/document.xml"))
    for (const phrase of phrasesOf(rendered)) expect(all).toContain(phrase)
    expect(await part("word/header1.xml")).toContain(DISCLAIMER)
    expect(await part("word/footer1.xml")).toContain(rendered.name)
  })
})
