import type { Inline } from "../parse/schema.ts"

// Cover page prose written in a definition: the intro that brings in the
// Standard Terms, the closing line and the attribution footer.

export function paragraph(...parts: (string | Inline)[]): Inline[] {
  return parts.map((part) =>
    typeof part === "string" ? { type: "text", value: part } : part
  )
}

export function bold(text: string): Inline {
  return { type: "strong", children: [{ type: "text", value: text }] }
}

export function link(text: string, href: string): Inline {
  return { type: "link", href, children: [{ type: "text", value: text }] }
}
