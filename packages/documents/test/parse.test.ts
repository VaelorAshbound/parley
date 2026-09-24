import { describe, expect, it } from "vite-plus/test"

import {
  COVER_PAGE_FILE,
  readCatalog,
  readTemplate as read,
} from "../src/parse/catalog.ts"
import {
  TemplateParseError,
  parseCoverPage,
  parseStandardTerms,
} from "../src/parse/parse.ts"
import type {
  Clause,
  CoverBlock,
  Inline,
  StandardTerms,
} from "../src/parse/schema.ts"

const standardFiles = readCatalog()
  .map((entry) => entry.filename)
  .filter((file) => file !== COVER_PAGE_FILE)

// --- Independent helpers: plain string work on the source and the tree. ---

const squash = (value: string) => value.replaceAll(/\s+/g, " ").trim()

/** The template's words with the markdown and HTML markup removed. */
function sourceText(markdown: string) {
  return squash(
    markdown
      .replaceAll(/^#+ /gm, "")
      .replaceAll(/^\s*(\d+|[a-z]+)\. /gm, "")
      .replaceAll(/<(https:[^>]+)>/g, "$1")
      .replaceAll(/<[^>]+>/g, "")
      .replaceAll("**", "")
      .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  )
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "hint":
          return node.value
        case "linkedTerm":
          return node.text
        default:
          return inlineText(node.children)
      }
    })
    .join("")
}

function clauseText(clause: Clause): string {
  return [
    clause.heading ?? "",
    inlineText(clause.content),
    ...clause.children.map(clauseText),
  ].join(" ")
}

function treeText(tree: StandardTerms) {
  return squash(
    [
      tree.title,
      ...tree.children.map((block) => {
        if (block.type === "paragraph") return inlineText(block.content)
        if (block.type === "section")
          return [block.heading, ...block.children.map(clauseText)].join(" ")
        return clauseText(block)
      }),
    ].join(" ")
  )
}

function* walk(clauses: Clause[]): Generator<Clause> {
  for (const clause of clauses) {
    yield clause
    yield* walk(clause.children)
  }
}

function clauses(tree: StandardTerms) {
  return [
    ...walk(
      tree.children.flatMap((block) =>
        block.type === "section"
          ? block.children
          : block.type === "clause"
            ? [block]
            : []
      )
    ),
  ]
}

function* inlines(nodes: Inline[]): Generator<Inline> {
  for (const node of nodes) {
    yield node
    if ("children" in node) yield* inlines(node.children)
  }
}

function linkedTerms(tree: StandardTerms) {
  return clauses(tree).flatMap((clause) =>
    [...inlines(clause.content)].filter((node) => node.type === "linkedTerm")
  )
}

function findClause(tree: StandardTerms, id: string) {
  const found = clauses(tree).find((clause) => clause.id === id)
  if (!found) throw new Error(`No clause ${id}`)
  return found
}

// --- Every template ---

describe.each(standardFiles)("%s", (file) => {
  const markdown = read(file)
  const tree = parseStandardTerms(markdown)

  it("keeps every word of the template, in order", () => {
    expect(treeText(tree)).toBe(sourceText(markdown))
  })

  it("ends every clause heading with its period", () => {
    const loose = clauses(tree).filter(
      (clause) => clause.heading !== undefined && !/[.:]$/.test(clause.heading)
    )

    expect(loose.map((clause) => clause.id)).toEqual([])
  })

  it("gives every clause a unique number", () => {
    const ids = clauses(tree).map((clause) => clause.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has linked terms", () => {
    expect(linkedTerms(tree).length).toBeGreaterThan(0)
  })
})

// --- Structure ---

describe("parseStandardTerms", () => {
  it("reads sections, clauses and lettered sub-clauses", () => {
    const csa = parseStandardTerms(read("CSA.md"))

    expect(csa.title).toBe("Cloud Service Agreement")
    expect(csa.children[4]).toMatchObject({
      type: "section",
      id: "5",
      heading: "Term & Termination",
    })
    const termination = findClause(csa, "5.3")
    expect(termination.heading).toBe("Termination.")
    expect(termination.children.map((clause) => clause.id)).toEqual([
      "5.3.a",
      "5.3.b",
    ])
  })

  it("numbers roman items under lettered ones, even after blank lines", () => {
    const dpa = parseStandardTerms(read("DPA.md"))
    const lettered = clauses(dpa).find((clause) =>
      clause.children.some((child) => child.id.endsWith(".i"))
    )

    expect(
      lettered?.children.map((clause) => clause.id.split(".").at(-1))
    ).toEqual(expect.arrayContaining(["i", "ii", "iii", "iv"]))
  })

  it("reads the NDA's numbered paragraphs and its attribution line", () => {
    const nda = parseStandardTerms(read("Mutual-NDA.md"))

    expect(nda.title).toBe("Standard Terms")
    expect(nda.children[0]).toMatchObject({ type: "clause", id: "1" })
    expect(nda.children.at(-1)).toMatchObject({
      type: "paragraph",
      content: expect.arrayContaining([
        {
          type: "link",
          href: "https://creativecommons.org/licenses/by/4.0/",
          children: [{ type: "text", value: "CC BY 4.0" }],
        },
      ]),
    })
  })

  it("finds the NDA's six cover page terms", () => {
    const nda = parseStandardTerms(read("Mutual-NDA.md"))
    const terms = new Set(linkedTerms(nda).map((node) => node.term))

    expect(terms).toEqual(
      new Set([
        "Purpose",
        "Effective Date",
        "MNDA Term",
        "Term of Confidentiality",
        "Governing Law",
        "Jurisdiction",
      ])
    )
  })

  it("keeps a possessive linked term's words but names the term", () => {
    const sla = parseStandardTerms(read("sla.md"))
    const possessive = linkedTerms(sla).find((node) => node.text !== node.term)

    expect(possessive).toEqual({
      type: "linkedTerm",
      kind: "coverpage",
      term: expect.stringMatching(/^(Customer|Provider)$/),
      text: expect.stringMatching(/^(Customer|Provider)’s$/),
    })
  })

  it("marks bold quoted terms as definitions", () => {
    const csa = parseStandardTerms(read("CSA.md"))
    const usageData = clauses(csa).find((clause) =>
      clause.content.some(
        (node) => node.type === "definition" && node.term === "Usage Data"
      )
    )

    expect(usageData?.id).toBe("13.31")
  })

  it("marks a definition whose quotes sit outside the bold", () => {
    const nda = parseStandardTerms(read("Mutual-NDA.md"))
    const terms = [...inlines(findClause(nda, "1").content)]
      .filter((node) => node.type === "definition")
      .map((node) => node.term)

    expect(terms).toEqual(
      expect.arrayContaining(["MNDA", "Disclosing Party", "Cover Page"])
    )
  })
})

describe("parseStandardTerms rejects what it does not understand", () => {
  it.each([
    ["an item that skips a number", "# T\n\n1. One\n3. Three\n"],
    ["an item indented too deep", "# T\n\n1. One\n        a. Deep\n"],
    ["a line that is not an item", "# T\n\n1. One\nloose words\n1. Again\n"],
    [
      "an unknown span class",
      '# T\n\n1. <span class="mystery_link">X</span>\n',
    ],
    ["a missing title", "1. One\n"],
  ])("%s", (_name, markdown) => {
    expect(() => parseStandardTerms(markdown)).toThrow(TemplateParseError)
  })
})

// --- The official NDA cover page ---

describe("parseCoverPage", () => {
  const cover = parseCoverPage(read(COVER_PAGE_FILE))
  const headings = cover.children
    .filter((block) => block.type === "heading")
    .map((block) => block.text)

  it("reads the headings", () => {
    expect(headings).toEqual([
      "Mutual Non-Disclosure Agreement",
      "USING THIS MUTUAL NON-DISCLOSURE AGREEMENT",
      "Purpose",
      "Effective Date",
      "MNDA Term",
      "Term of Confidentiality",
      "Governing Law & Jurisdiction",
      "MNDA Modifications",
    ])
  })

  it("keeps the label under a heading as a hint", () => {
    const afterPurpose =
      cover.children[cover.children.findIndex(isHeading("Purpose")) + 1]

    expect(afterPurpose).toEqual({
      type: "paragraph",
      content: [
        { type: "hint", value: "How Confidential Information may be used" },
      ],
    })
  })

  it("reads the checkbox choices", () => {
    const options = cover.children.filter((block) => block.type === "options")

    expect(options).toHaveLength(2)
    expect(options[0]).toMatchObject({
      items: [{ checked: true }, { checked: false }],
    })
  })

  it("reads the signature table", () => {
    const table = cover.children.find((block) => block.type === "table")

    expect(table?.rows.map((row) => inlineText(row[0] ?? []))).toEqual([
      "",
      "Signature",
      "Print Name",
      "Title",
      "Company",
      "Notice Address Use either email or postal address",
      "Date",
    ])
  })
})

function isHeading(text: string) {
  return (block: CoverBlock) => block.type === "heading" && block.text === text
}
