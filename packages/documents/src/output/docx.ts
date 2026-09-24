import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from "docx"

import type {
  Part,
  RenderedClause,
  RenderedDocument,
  RenderedInline,
  RenderedLine,
  RenderedTable,
  RenderedValue,
} from "../render.ts"

// The editable Word file (T24). It uses Georgia, not the brand's Newsreader:
// the person opening it in Word almost never has Newsreader installed, and a
// substituted font would reflow the whole contract.

export type DocxOptions = { pageSize?: "Letter" | "A4" }

const PAGE = {
  // Twentieths of a point (DXA); 1440 = 1 inch.
  Letter: { width: 12240, height: 15840 },
  A4: { width: 11906, height: 16838 },
} as const
const MARGIN = 1440

const INK = "1B1A17"
const INK_2 = "57544C"
const INK_3 = "6A665D"
const BLUE_INK = "2743C4"
const RULE = "D5CFC2"
const SERIF = "Georgia"
const SANS = "Arial"
const SYMBOLS = "Segoe UI Symbol"

export async function toDocx(
  document: RenderedDocument,
  { pageSize = "Letter" }: DocxOptions = {}
): Promise<ArrayBuffer> {
  const page = PAGE[pageSize]
  const width = page.width - 2 * MARGIN
  const { coverPage, standardTerms } = document

  const doc = new Document({
    creator: "Parley",
    title: document.name,
    styles: {
      // Override the built-in heading styles, so Word's navigation pane and
      // outline still know them as headings.
      default: {
        document: {
          run: { font: SERIF, size: 21, color: INK },
          paragraph: { spacing: { after: 120, line: 312 } },
        },
        heading1: heading(40),
        heading2: heading(24),
        heading3: heading(22),
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: page,
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        footers: { default: footer(document.name, width) },
        children: [
          ...(coverPage.eyebrow
            ? [small(coverPage.eyebrow, { allCaps: true })]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: coverPage.title,
          }),
          ...(coverPage.subtitle ? [small(coverPage.subtitle)] : []),
          ...coverPage.intro.map(
            (nodes) => new Paragraph({ children: inline(nodes) })
          ),
          coverTable(document, width),
          ...coverPage.closing.map(
            (nodes) => new Paragraph({ children: inline(nodes) })
          ),
          ...signatureTable(document, width),
          ...coverPage.footer.map(
            (nodes) =>
              new Paragraph({
                children: inline(nodes, { size: 16, color: INK_2 }),
              })
          ),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            text: standardTerms.title,
          }),
          ...standardTerms.children.flatMap((block) => {
            if (block.type === "paragraph")
              return [
                new Paragraph({
                  spacing: { before: 240 },
                  children: inline(block.content, { size: 16, color: INK_2 }),
                }),
              ]
            if (block.type === "clause") return clause(block, 0)
            return [
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                text: `${block.id}. ${block.heading}`,
              }),
              ...block.children.flatMap((child) => clause(child, 0)),
            ]
          }),
        ],
      },
    ],
  })
  return Packer.toArrayBuffer(doc)
}

function heading(size: number) {
  return {
    run: { font: SERIF, size, bold: true, color: INK },
    paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
  }
}

function small(text: string, options: IRunOptions = {}) {
  return new Paragraph({
    children: [
      new TextRun({ text, font: SANS, size: 15, color: INK_3, ...options }),
    ],
  })
}

function footer(name: string, width: number) {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: width }],
        children: [
          new TextRun({
            font: SANS,
            size: 15,
            color: INK_3,
            children: [
              name,
              new Tab(),
              "Page ",
              PageNumber.CURRENT,
              " of ",
              PageNumber.TOTAL_PAGES,
            ],
          }),
        ],
      }),
    ],
  })
}

/** Text runs; a line break inside a value becomes a real Word break. */
function runs(text: string, options: IRunOptions): TextRun[] {
  return text
    .split("\n")
    .map(
      (line, index) =>
        new TextRun({ ...options, text: line, break: index > 0 ? 1 : 0 })
    )
}

function inline(
  nodes: RenderedInline[],
  options: IRunOptions = {}
): ParagraphChild[] {
  // The declared return type makes the switch exhaustive: a new node type
  // is a compile error here, never printed as something else.
  return nodes.flatMap((node): ParagraphChild[] => {
    switch (node.type) {
      case "text":
        return runs(node.value, options)
      case "hint":
        return runs(node.value, {
          ...options,
          font: SANS,
          size: 16,
          color: INK_3,
        })
      case "linkedTerm":
        return runs(node.text, options)
      case "link":
        return [
          new ExternalHyperlink({
            link: node.href,
            children: inline(node.children, {
              ...options,
              underline: {},
            }).filter((child) => child instanceof TextRun),
          }),
        ]
      case "strong":
      case "definition":
        return inline(node.children, { ...options, bold: true })
    }
  })
}

function value({ text, placeholder }: RenderedValue): TextRun[] {
  return text === null
    ? runs(placeholder, { color: INK_3 })
    : runs(text, { color: BLUE_INK })
}

function part(each: Part): TextRun[] {
  return each.type === "text" ? runs(each.text, {}) : value(each)
}

function line(each: RenderedLine) {
  const box =
    each.checked === undefined
      ? []
      : [new TextRun({ text: `${each.checked ? "☒" : "☐"} `, font: SYMBOLS })]
  const label = each.label
    ? [
        new TextRun({
          text: `${each.label}: `,
          font: SANS,
          size: 17,
          color: INK_2,
        }),
      ]
    : []
  return new Paragraph({
    children: [...box, ...label, ...each.parts.flatMap(part)],
  })
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "auto" }
const ROW_BORDER = {
  top: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
}

function cell(size: number, children: (Paragraph | Table)[]) {
  return new TableCell({
    width: { size, type: WidthType.DXA },
    borders: ROW_BORDER,
    margins: { top: 80, bottom: 80, right: 120 },
    children,
  })
}

/** The cover page as an order form: section on the left, values on the right. */
function coverTable({ coverPage }: RenderedDocument, width: number) {
  const left = Math.round(width * 0.32)
  const right = width - left
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [left, right],
    rows: coverPage.sections.map((section) =>
      section.part
        ? new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                columnSpan: 2,
                width: { size: width, type: WidthType.DXA },
                borders: ROW_BORDER,
                margins: { top: 200, bottom: 80 },
                children: [
                  new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    text: section.heading,
                  }),
                  ...(section.hint ? [small(section.hint)] : []),
                ],
              }),
            ],
          })
        : new TableRow({
            cantSplit: true,
            children: [
              cell(left, [
                new Paragraph({
                  children: [
                    new TextRun({ text: section.heading, bold: true }),
                  ],
                }),
                ...(section.hint ? [small(section.hint)] : []),
              ]),
              cell(right, [
                ...section.lines.map(line),
                ...(section.table
                  ? [listTable(section.table, right - 240)]
                  : []),
              ]),
            ],
          })
    ),
  })
}

/** A list field's records, as a table nested in the cover page's cell. */
function listTable({ columns, rows }: RenderedTable, width: number) {
  const column = Math.floor(width / columns.length)
  const label = (text: string) =>
    new Paragraph({
      children: [
        new TextRun({ text, font: SANS, size: 16, bold: true, color: INK_2 }),
      ],
    })
  return new Table({
    width: { size: column * columns.length, type: WidthType.DXA },
    columnWidths: columns.map(() => column),
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map((text) => cell(column, [label(text)])),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((shown) =>
              cell(column, [new Paragraph({ children: value(shown) })])
            ),
          })
      ),
    ],
  })
}

function signatureTable({ coverPage }: RenderedDocument, width: number) {
  const { parties, rows } = coverPage.signatures
  if (parties.length === 0) return []
  const labelWidth = Math.round(width * 0.24)
  const column = Math.floor((width - labelWidth) / parties.length)
  const label = (text: string) =>
    new Paragraph({
      children: [
        new TextRun({ text, font: SANS, size: 17, bold: true, color: INK_2 }),
      ],
    })
  return [
    new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [labelWidth, ...parties.map(() => column)],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell(labelWidth, [new Paragraph({})]),
            ...parties.map((party) => cell(column, [label(party.label)])),
          ],
        }),
        ...rows.map(
          (row) =>
            new TableRow({
              cantSplit: true,
              height: { value: 520, rule: HeightRule.ATLEAST },
              children: [
                cell(labelWidth, [label(row.label)]),
                ...row.cells.map((shown) =>
                  cell(column, [
                    new Paragraph({ children: shown ? value(shown) : [] }),
                  ])
                ),
              ],
            })
        ),
      ],
    }),
    new Paragraph({}),
  ]
}

function clause(node: RenderedClause, depth: number): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: depth * 360 },
      children: [
        new TextRun({ text: `${node.number} `, bold: true }),
        ...(node.heading
          ? [new TextRun({ text: `${node.heading} `, bold: true })]
          : []),
        ...inline(node.content),
      ],
    }),
    ...node.children.flatMap((child) => clause(child, depth + 1)),
  ]
}
