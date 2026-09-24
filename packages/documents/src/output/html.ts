import type {
  Part,
  RenderedClause,
  RenderedDocument,
  RenderedInline,
  RenderedLine,
  RenderedTable,
  RenderedValue,
} from "../render.ts"

// The print page Browser Run turns into the PDF (T24). Printed paper stays
// light in both themes (brand.md → Color); filled-in values are blue ink,
// like a pen on a form.

export type PrintOptions = {
  pageSize?: "Letter" | "A4"
  /**
   * `@font-face` rules for Newsreader and Instrument Sans. Browser Run has
   * neither (T2), and a local dev server can't serve them to it, so the caller
   * embeds them (data URLs) rather than linking. Inserted as is: it must
   * come from our own font files, never from anything a user typed.
   */
  fontCss?: string
}

const PARLEY_LABEL = "Cover page by Parley, not by Common Paper"

export function toPrintHtml(
  document: RenderedDocument,
  { pageSize = "Letter", fontCss = "" }: PrintOptions = {}
) {
  const { coverPage, standardTerms } = document
  const body = [
    '<section class="cover">',
    coverPage.source === "parley"
      ? `<p class="eyebrow">${PARLEY_LABEL}</p>`
      : "",
    `<h1>${escape(coverPage.title)}</h1>`,
    coverPage.subtitle
      ? `<h2 class="subtitle">${escape(coverPage.subtitle)}</h2>`
      : "",
    ...coverPage.intro.map(paragraph),
    ...coverPage.sections.map((section) =>
      section.part
        ? `<h2 class="part">${escape(section.heading)}</h2>`
        : `<section class="field"><h3>${escape(section.heading)}</h3>${
            section.hint ? `<p class="hint">${escape(section.hint)}</p>` : ""
          }${section.lines.map(line).join("")}${
            section.table ? listTable(section.table) : ""
          }</section>`
    ),
    // "By signing…" stays on the page with the table it introduces.
    `<div class="signing">${coverPage.closing.map(paragraph).join("")}${signatures(document)}</div>`,
    ...coverPage.footer.map(
      (each) => `<p class="attribution">${inline(each)}</p>`
    ),
    "</section>",
    '<section class="terms">',
    `<h1>${escape(standardTerms.title)}</h1>`,
    termsBody(standardTerms.children),
    "</section>",
  ].join("")

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(
    document.name
  )}</title><style>${fontCss}${styles(document.name, pageSize)}</style></head><body>${body}</body></html>`
}

type TermsBlock = RenderedDocument["standardTerms"]["children"][number]

function termsBody(blocks: TermsBlock[]) {
  const html = (block: TermsBlock) => {
    if (block.type === "paragraph")
      return `<p class="attribution">${inline(block.content)}</p>`
    if (block.type === "clause") return clause(block)
    return `<section><h2><span class="number">${escape(block.id)}.</span> ${escape(
      block.heading
    )}</h2>${block.children.map(clause).join("")}</section>`
  }
  // The closing attribution line never sits alone on the last page: it is
  // kept with the clause before it.
  const closing = blocks.findIndex((block) => block.type === "paragraph")
  if (closing <= 0) return blocks.map(html).join("")
  return `${blocks
    .slice(0, closing - 1)
    .map(html)
    .join("")}<div class="keep">${blocks
    .slice(closing - 1)
    .map(html)
    .join("")}</div>`
}

function paragraph(nodes: RenderedInline[]) {
  return `<p>${inline(nodes)}</p>`
}

function inline(nodes: RenderedInline[]): string {
  return (
    nodes
      // The declared return type makes the switch exhaustive: a new node type
      // is a compile error here, never printed as something else.
      .map((node): string => {
        switch (node.type) {
          case "text":
            return escape(node.value)
          case "hint":
            return `<span class="hint">${escape(node.value)}</span>`
          case "linkedTerm":
            return `<span class="term">${escape(node.text)}</span>`
          case "link":
            return `<a href="${escape(node.href)}">${inline(node.children)}</a>`
          case "strong":
          case "definition":
            return `<strong>${inline(node.children)}</strong>`
        }
      })
      .join("")
  )
}

function value({ text, placeholder }: RenderedValue) {
  return text === null
    ? `<span class="value missing">${escape(placeholder)}</span>`
    : `<span class="value">${escape(text).replaceAll("\n", "<br>")}</span>`
}

function part(each: Part) {
  return each.type === "text" ? escape(each.text) : value(each)
}

function line(each: RenderedLine) {
  const box =
    each.checked === undefined ? "" : each.checked ? BOX_CHECKED : BOX_EMPTY
  const label = each.label
    ? `<span class="label">${escape(each.label)}:</span> `
    : ""
  return `<p class="line${each.checked === false ? " unchosen" : ""}">${box}${label}${each.parts
    .map(part)
    .join("")}</p>`
}

// Drawn, not typed: Browser Run's fonts may lack ☒ and ☐ (T2).
const BOX_EMPTY =
  '<svg class="box" role="img" aria-label="Not selected" viewBox="0 0 12 12"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2" fill="none" stroke="#a29d92" stroke-width="1.2"/></svg> '
const BOX_CHECKED =
  '<svg class="box checked" role="img" aria-label="Selected" viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill="#2743c4"/><path d="M3 6.2 5.1 8.3 9 3.9" fill="none" stroke="#fdfdff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> '

function listTable({ columns, rows }: RenderedTable) {
  const head = columns.map((column) => `<th scope="col">${escape(column)}</th>`)
  const body = rows.map(
    (row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join("")}</tr>`
  )
  return `<table class="list"><thead><tr>${head.join("")}</tr></thead><tbody>${body.join("")}</tbody></table>`
}

function signatures({ coverPage }: RenderedDocument) {
  const [first] = coverPage.signatures
  if (!first) return ""
  const head = coverPage.signatures
    .map((block) => `<th scope="col">${escape(block.label)}</th>`)
    .join("")
  const rows = first.rows
    .map((row, index) => {
      const cells = coverPage.signatures
        .map((block) => {
          const cell = block.rows[index]?.value
          return `<td${cell ? "" : ' class="sign"'}>${cell ? value(cell) : ""}</td>`
        })
        .join("")
      return `<tr><th scope="row">${escape(row.label)}</th>${cells}</tr>`
    })
    .join("")
  return `<table class="signatures"><thead><tr><td></td>${head}</tr></thead><tbody>${rows}</tbody></table>`
}

function clause(node: RenderedClause): string {
  const heading = node.heading
    ? `<strong>${escape(node.heading)}</strong> `
    : ""
  return `<div class="clause"><p><span class="number">${escape(
    node.number
  )}</span> ${heading}${inline(node.content)}</p>${node.children
    .map(clause)
    .join("")}</div>`
}

function escape(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** A CSS string literal, for the page margin boxes. */
function cssString(text: string) {
  // "<" as a CSS escape: a name with "</style>" can't close the style block.
  return `"${text
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("<", "\\3C ")}"`
}

function styles(name: string, pageSize: "Letter" | "A4") {
  return `
@page {
  size: ${pageSize};
  margin: 0.9in 1in 1in;
  @bottom-left { content: ${cssString(name)}; font: 8pt var(--sans); color: #6a665d; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt var(--sans); color: #6a665d; }
}
:root {
  --serif: "Newsreader Variable", Georgia, "Times New Roman", serif;
  --sans: "Instrument Sans Variable", Arial, sans-serif;
  color: #1b1a17;
  font: 10.5pt/1.5 var(--serif);
  font-optical-sizing: auto;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body { margin: 0; }
h1 { font-size: 22pt; font-weight: 500; letter-spacing: -0.02em; line-height: 1.1; margin: 0 0 6pt; }
h2 { font-size: 12pt; font-weight: 600; margin: 16pt 0 6pt; break-after: avoid; }
h3 { font-size: 11pt; font-weight: 600; margin: 0 0 2pt; break-after: avoid; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
a { color: inherit; }
.eyebrow, .hint, .label, .subtitle, .signatures th, .attribution { font-family: var(--sans); }
.eyebrow { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6a665d; margin-bottom: 10pt; }
.subtitle { font-size: 8pt; letter-spacing: 0.08em; color: #57544c; margin: 12pt 0 4pt; }
.part { font-size: 13pt; margin: 18pt 0 4pt; }
.field { border-top: 0.5pt solid #e3ded3; padding: 8pt 0 4pt; break-inside: avoid; }
.hint { display: block; font-size: 8pt; color: #6a665d; margin: 0 0 4pt; }
.label { font-size: 8.5pt; color: #57544c; }
.line.unchosen { color: #6a665d; }
.box { width: 9pt; height: 9pt; vertical-align: -1pt; }
.signing, .keep { break-inside: avoid; }
.value { color: #2743c4; }
.value.missing { color: #6a665d; }
.signatures { width: 100%; border-collapse: collapse; margin: 12pt 0; break-inside: avoid; }
.signatures th, .signatures td { border-bottom: 0.5pt solid #d5cfc2; padding: 6pt 8pt 4pt 0; text-align: left; vertical-align: bottom; }
.signatures th { font-size: 8.5pt; font-weight: 600; color: #57544c; width: 22%; }
.signatures td { width: 39%; }
.signatures td.sign { height: 28pt; }
.attribution { font-size: 8pt; color: #57544c; margin-top: 12pt; }
.list { width: 100%; border-collapse: collapse; margin: 2pt 0 6pt; }
.list th { font: 600 8pt var(--sans); color: #57544c; text-align: left; }
.list th, .list td { border-bottom: 0.5pt solid #e3ded3; padding: 3pt 8pt 3pt 0; vertical-align: top; }
.terms { break-before: page; }
.clause { margin-left: 0; }
.clause .clause { margin-left: 18pt; }
.number { font-variant-numeric: tabular-nums; font-weight: 600; }
`
}
