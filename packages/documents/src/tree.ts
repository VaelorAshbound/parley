import type { Clause, Inline, StandardTerms } from "./parse/schema.ts"

/** Every clause of a template, depth first, in reading order. */
export function* clausesOf(tree: StandardTerms): Generator<Clause> {
  function* walk(clauses: Clause[]): Generator<Clause> {
    for (const clause of clauses) {
      yield clause
      yield* walk(clause.children)
    }
  }
  for (const block of tree.children) {
    if (block.type === "section") yield* walk(block.children)
    else if (block.type === "clause") yield* walk([block])
  }
}

/** Every inline node, nested ones included, in reading order. */
export function* inlinesOf(nodes: Inline[]): Generator<Inline> {
  for (const node of nodes) {
    yield node
    if ("children" in node) yield* inlinesOf(node.children)
  }
}

/** The linked terms of a template, closing paragraphs included. */
export function linkedTermsOf(tree: StandardTerms) {
  const paragraphs = tree.children.flatMap((block) =>
    block.type === "paragraph" ? [block.content] : []
  )
  return [
    ...[...clausesOf(tree)].map((clause) => clause.content),
    ...paragraphs,
  ]
    .flatMap((content) => [...inlinesOf(content)])
    .filter((node) => node.type === "linkedTerm")
}
