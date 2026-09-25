import type { RenderedInline } from "@workspace/documents"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

// Running text of the standard terms and the cover page's paragraphs. The
// terms stay word for word; a linked term ("Purpose") shows the value behind
// it on hover or focus, and a click opens that field's editor.

export function Inline({
  nodes,
  onEdit,
}: {
  nodes: RenderedInline[]
  onEdit?: ((path: string) => void) | undefined
}) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.value
      case "hint":
        return (
          <span key={index} className="font-sans text-[0.86em] text-ink-3">
            {node.value}
          </span>
        )
      case "strong":
      case "definition":
        return (
          <strong key={index}>
            <Inline nodes={node.children} onEdit={onEdit} />
          </strong>
        )
      case "link":
        return (
          <a key={index} href={node.href} target="_blank" rel="noreferrer">
            <Inline nodes={node.children} onEdit={onEdit} />
          </a>
        )
      case "linkedTerm":
        return <LinkedTerm key={index} node={node} onEdit={onEdit} />
    }
  })
}

function LinkedTerm({
  node,
  onEdit,
}: {
  node: Extract<RenderedInline, { type: "linkedTerm" }>
  onEdit?: ((path: string) => void) | undefined
}) {
  const [first] = node.values
  // A term no field fills (none today: a coverage test) stays plain text,
  // and so does every term of a read-only document: the cover page above
  // shows its value.
  if (!first || !onEdit) return node.text
  const shown = node.values.map(
    (value) => `${value.label}: ${value.text ?? "not filled yet"}`
  )
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            // Base UI tooltips are visual only, so the value is in the name.
            aria-label={`${node.text} (${shown.join("; ")})`}
            onClick={() => onEdit(first.field)}
            className="cursor-pointer rounded-sm underline decoration-blue-ink/40 decoration-dotted underline-offset-[3px] outline-none hover:decoration-blue-ink focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {node.text}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start">
        {shown.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
