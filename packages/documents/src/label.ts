// Option labels hold blanks by name: "The greater of {amount} or {multiple}x
// the fees". The choice schema, its format and the render model all read
// labels through this one tokenizer.

export type LabelPiece =
  | { type: "text"; text: string }
  | { type: "blank"; name: string }

const BLANK = /\{(\w+)\}/g

export function splitLabel(label: string): LabelPiece[] {
  const pieces: LabelPiece[] = []
  let end = 0
  for (const match of label.matchAll(BLANK)) {
    if (match.index > end)
      pieces.push({ type: "text", text: label.slice(end, match.index) })
    pieces.push({ type: "blank", name: String(match[1]) })
    end = match.index + match[0].length
  }
  if (end < label.length) pieces.push({ type: "text", text: label.slice(end) })
  return pieces
}
