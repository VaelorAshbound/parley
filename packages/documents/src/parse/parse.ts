import type { Element, ElementContent, Root } from "hast"
import { toString } from "hast-util-to-string"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import {
  coverPage,
  linkKind,
  standardTerms,
  type Clause,
  type CoverBlock,
  type CoverPage,
  type Inline,
  type StandardTerms,
} from "./schema.ts"

// Build-time only: turns a Common Paper template into the typed tree in
// schema.ts. It is strict on purpose. The 12 templates are fixed inputs, so
// anything it does not understand is an error, never a guess.

export class TemplateParseError extends Error {
  override name = "TemplateParseError"

  constructor(message: string, line?: number) {
    super(line === undefined ? message : `Line ${line}: ${message}`)
  }
}

// remark reads the markdown; rehype-raw turns the templates' inline <span>
// and <label> tags into real elements.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)

function toHast(markdown: string): Root {
  return processor.runSync(processor.parse(markdown))
}

/** The element children of a hast parent, without the newlines between them. */
function blocks(parent: Root | Element): Element[] {
  return parent.children.flatMap((node) => {
    if (node.type === "element") return [node]
    if (node.type === "text" && node.value.trim() === "") return []
    throw new TemplateParseError(`Unexpected ${node.type} outside a block`)
  })
}

function classesOf(element: Element) {
  const value = element.properties.className
  return Array.isArray(value) ? value.map(String) : []
}

const HEADING_CLASS = /^header_[23]$/

function isHeadingSpan(node: ElementContent | undefined): node is Element {
  return (
    node?.type === "element" &&
    node.tagName === "span" &&
    classesOf(node).some((name) => HEADING_CLASS.test(name))
  )
}

// --- Inline content ---

function toInline(nodes: ElementContent[], line?: number): Inline[] {
  const result: Inline[] = []
  const pushText = (value: string) => {
    const last = result.at(-1)
    if (last?.type === "text") last.value += value
    else result.push({ type: "text", value })
  }

  for (const node of nodes) {
    if (node.type === "text") {
      pushText(node.value)
      continue
    }
    if (node.type !== "element")
      throw new TemplateParseError(`Unexpected inline ${node.type}`, line)

    switch (node.tagName) {
      case "strong":
        result.push({ type: "strong", children: toInline(node.children, line) })
        break
      case "a": {
        const href = node.properties.href
        if (typeof href !== "string")
          throw new TemplateParseError("A link has no href", line)
        result.push({
          type: "link",
          // Partnership-Agreement.md links to "commonpaper.com/…" with no
          // scheme, which would be a relative link. The text shows https.
          href: /^[a-z]+:/.test(href) ? href : `https://${href}`,
          children: toInline(node.children, line),
        })
        break
      }
      case "label":
        result.push({ type: "hint", value: toString(node) })
        break
      case "span":
        for (const inline of spanToInline(node, line)) {
          if (inline.type === "text") pushText(inline.value)
          else result.push(inline)
        }
        break
      default:
        throw new TemplateParseError(`Unexpected <${node.tagName}>`, line)
    }
  }
  return markDefinitions(result)
}

function spanToInline(span: Element, line?: number): Inline[] {
  const classes = classesOf(span)
  if (classes.length === 0) return toInline(span.children, line)

  const kind = linkKind.safeParse(
    classes.length === 1 ? classes[0]?.replace(/_link$/, "") : undefined
  )
  if (!kind.success || !classes[0]?.endsWith("_link"))
    throw new TemplateParseError(
      `Unknown span class "${classes.join(" ")}"`,
      line
    )
  if (span.children.some((child) => child.type !== "text"))
    throw new TemplateParseError("A linked term holds markup", line)

  const text = toString(span)
  // "Customer’s" fills from the "Customer" field; the renderer keeps the "’s".
  const term = text.replace(/[’']s$/, "")
  return [{ type: "linkedTerm", kind: kind.data, term, text }]
}

const QUOTED = /^["“](.+)["”]$/

/**
 * Bold, quoted terms are definitions: **"Usage Data"** in most templates,
 * “**MNDA**” (quotes outside the bold) in the NDA.
 */
function markDefinitions(nodes: Inline[]): Inline[] {
  return nodes.map((node, index) => {
    if (node.type !== "strong") return node
    const text = inlineText(node.children)
    const inner = QUOTED.exec(text)?.[1]
    if (inner)
      return { type: "definition", term: inner, children: node.children }

    const before = nodes[index - 1]
    const after = nodes[index + 1]
    const quotedOutside =
      before?.type === "text" &&
      /["“]$/.test(before.value) &&
      after?.type === "text" &&
      /^["”]/.test(after.value)
    return quotedOutside
      ? { type: "definition", term: text, children: node.children }
      : node
  })
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "hint") return node.value
      if (node.type === "linkedTerm") return node.text
      return inlineText(node.children)
    })
    .join("")
}

/** Parses one line of markdown that must be a single paragraph. */
function parseLine(markdown: string, line: number): ElementContent[] {
  const [paragraph, ...rest] = blocks(toHast(markdown))
  if (!paragraph || paragraph.tagName !== "p" || rest.length > 0)
    throw new TemplateParseError("Expected one line of text", line)
  return paragraph.children
}

// --- Standard terms ---

const ITEM = /^( *)(\d+|[a-z]+)\. (.*)$/
const INDENT = 4
const MAX_DEPTH = 3
const ROMAN = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx",
]

/** The marker a list should use next, given its first and last markers. */
function nextMarker(first: string | undefined, last: string | undefined) {
  if (first === undefined || last === undefined) return undefined
  if (/^\d+$/.test(first)) return String(Number(last) + 1)
  if (first === "i") return ROMAN[ROMAN.indexOf(last) + 1]
  return String.fromCharCode(last.charCodeAt(0) + 1)
}

function isFirstMarker(marker: string) {
  return marker === "1" || marker === "a" || marker === "i"
}

/** An item that later, deeper lines can nest under. */
type Open = { id: string; children: Clause[] }

export function parseStandardTerms(markdown: string): StandardTerms {
  // design-partner-agreement.md has Windows line endings.
  const lines = markdown.split(/\r?\n/)
  const titleIndex = lines.findIndex((text) => text.trim() !== "")
  const title = /^# (.+)$/.exec(lines[titleIndex] ?? "")?.[1]
  if (!title) throw new TemplateParseError("Expected a # title", titleIndex + 1)

  const tree: StandardTerms = { type: "standardTerms", title, children: [] }
  // stack[d] is the open item at depth d; markers[d] are its siblings' markers.
  const stack: Open[] = []
  const markers: string[][] = [[]]
  let listEnded = false

  lines.forEach((text, index) => {
    const line = index + 1
    if (index <= titleIndex || text.trim() === "") return

    const match = ITEM.exec(text)
    if (!match) {
      if (text.startsWith(" "))
        throw new TemplateParseError("Expected a list item", line)
      listEnded = true
      tree.children.push({
        type: "paragraph",
        content: toInline(parseLine(text, line), line),
      })
      return
    }
    if (listEnded)
      throw new TemplateParseError("A list item after the closing text", line)

    const [, indent = "", marker = "", rest = ""] = match
    const depth = indent.length / INDENT
    if (!Number.isInteger(depth) || depth > MAX_DEPTH || depth > stack.length)
      throw new TemplateParseError("Unexpected indentation", line)

    stack.length = depth
    markers.length = depth + 1
    const siblings = (markers[depth] ??= [])
    const expected = nextMarker(siblings[0], siblings.at(-1))
    if (expected === undefined ? !isFirstMarker(marker) : marker !== expected)
      throw new TemplateParseError(
        `Expected item "${expected ?? "1, a or i"}", found "${marker}"`,
        line
      )
    siblings.push(marker)

    const parent = stack[depth - 1]
    const id = parent ? `${parent.id}.${marker}` : marker
    const nodes = parseLine(rest, line)
    const [first, ...afterHeading] = nodes
    let heading = isHeadingSpan(first) ? toString(first) : undefined
    const inline = toInline(heading === undefined ? nodes : afterHeading, line)
    const lead = inline[0]
    if (heading !== undefined && lead?.type === "text") {
      // One Software License heading has its period outside the span.
      const stray = /[.:]$/.test(heading) ? undefined : /^[.:]/.exec(lead.value)
      if (stray) {
        heading += stray[0]
        lead.value = lead.value.slice(1)
      }
      lead.value = lead.value.trimStart()
      if (lead.value === "") inline.shift()
    }

    const isSection =
      depth === 0 &&
      first?.type === "element" &&
      classesOf(first).includes("header_2")
    if (isSection) {
      if (heading === undefined || inline.length > 0)
        throw new TemplateParseError("A section holds text", line)
      const children: Clause[] = []
      tree.children.push({ type: "section", id, heading, children })
      stack.push({ id, children })
      return
    }

    const clause: Clause = {
      type: "clause",
      id,
      ...(heading === undefined ? {} : { heading }),
      content: inline,
      children: [],
    }
    if (parent) parent.children.push(clause)
    else tree.children.push(clause)
    stack.push(clause)
  })

  return standardTerms.parse(tree)
}

// --- The official NDA cover page ---

export function parseCoverPage(markdown: string): CoverPage {
  const children = blocks(toHast(markdown)).map((element): CoverBlock => {
    switch (element.tagName) {
      case "h1":
      case "h2":
      case "h3":
        return {
          type: "heading",
          depth: Number(element.tagName.slice(1)),
          text: toString(element),
        }
      case "p":
        return { type: "paragraph", content: toInline(element.children) }
      case "ul":
        return { type: "options", items: blocks(element).map(toOption) }
      case "table":
        return {
          type: "table",
          rows: blocks(element)
            .flatMap(blocks)
            .map((row) =>
              blocks(row).map((cell) => trimInline(toInline(cell.children)))
            ),
        }
      default:
        throw new TemplateParseError(`Unexpected <${element.tagName}>`)
    }
  })
  return coverPage.parse({ type: "coverPage", children })
}

function toOption(item: Element) {
  const [box, ...content] = item.children
  if (
    box?.type !== "element" ||
    box.tagName !== "input" ||
    box.properties.type !== "checkbox"
  )
    throw new TemplateParseError("A cover page list item has no checkbox")
  return {
    checked: box.properties.checked === true,
    content: trimInline(toInline(content)),
  }
}

/** Drops the padding markdown leaves around a cell or checkbox line. */
function trimInline(nodes: Inline[]): Inline[] {
  const result = nodes.map((node) => ({ ...node }))
  const first = result[0]
  if (first?.type === "text") first.value = first.value.trimStart()
  const last = result.at(-1)
  if (last?.type === "text") last.value = last.value.trimEnd()
  return result.filter((node) => node.type !== "text" || node.value !== "")
}
