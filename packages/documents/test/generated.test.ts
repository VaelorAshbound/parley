import { describe, expect, it } from "vite-plus/test"

import {
  COVER_PAGE_FILE,
  readCatalog,
  readTemplate,
  templateId,
} from "../src/parse/catalog.ts"
import { parseCoverPage, parseStandardTerms } from "../src/parse/parse.ts"
import type { Clause, Inline, StandardTerms } from "../src/parse/schema.ts"

const files = readCatalog().map((entry) => entry.filename)

describe.each(files)("%s", (file) => {
  const markdown = readTemplate(file)
  const tree =
    file === COVER_PAGE_FILE
      ? parseCoverPage(markdown)
      : parseStandardTerms(markdown)

  it("matches its generated module (run `pnpm documents:build`)", async () => {
    const generated: { default: unknown } = await import(
      `../generated/${templateId(file)}.ts`
    )

    expect(generated.default).toEqual(tree)
  })

  // A short outline per template, kept in git for review: every clause
  // number, its heading, the terms it defines and the linked terms it uses.
  it.runIf(tree.type === "standardTerms")(
    "has a reviewed outline",
    async () => {
      if (tree.type !== "standardTerms") return

      await expect(outline(tree)).toMatchFileSnapshot(
        `__outlines__/${templateId(file)}.txt`
      )
    }
  )
})

function outline(tree: StandardTerms) {
  const lines = [`# ${tree.title}`]
  const addClause = (clause: Clause, depth: number) => {
    const terms = [...new Set(linkedTerms(clause.content))]
    const defines = clause.content.flatMap((node) =>
      node.type === "definition" ? [`"${node.term}"`] : []
    )
    lines.push(
      [
        `${"  ".repeat(depth)}${clause.id}`,
        clause.heading,
        defines.length > 0 ? `defines ${defines.join(", ")}` : undefined,
        terms.length > 0 ? `[${terms.join(", ")}]` : undefined,
      ]
        .filter(Boolean)
        .join(" ")
    )
    for (const child of clause.children) addClause(child, depth + 1)
  }
  for (const block of tree.children) {
    if (block.type === "paragraph") lines.push("(closing paragraph)")
    else if (block.type === "clause") addClause(block, 0)
    else {
      lines.push(`${block.id} ${block.heading}`)
      for (const clause of block.children) addClause(clause, 1)
    }
  }
  return `${lines.join("\n")}\n`
}

function linkedTerms(nodes: Inline[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type === "linkedTerm") return [`${node.kind}:${node.term}`]
    return "children" in node ? linkedTerms(node.children) : []
  })
}
