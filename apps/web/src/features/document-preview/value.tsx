import type { RenderedValue } from "@workspace/documents"
import { cn } from "@workspace/ui/lib/utils"

// A field's value in the live document (brand.md → A field's life): blue ink
// when filled, a dashed chip with the field's name while empty. Never a blank
// line: the PDF prints the same empty value as "[Name]".

/** The short name an empty chip shows: "Party 1: Company" → "Company". */
export function shortLabel(label: string) {
  return label.slice(label.lastIndexOf(": ") + 1).trim()
}

export function Value({
  value,
  className,
}: {
  value: RenderedValue
  className?: string
}) {
  if (value.text === null)
    return (
      <span
        data-field={value.field}
        data-empty=""
        className={cn(
          "rounded-[5px] border border-dashed border-empty-border bg-empty px-1.5 py-px font-sans text-[0.86em] leading-snug whitespace-nowrap text-ink-3",
          className
        )}
      >
        {shortLabel(value.label)}
      </span>
    )
  return (
    <span
      data-field={value.field}
      className={cn("whitespace-pre-line text-blue-ink", className)}
    >
      {value.text}
    </span>
  )
}

/** The words a screen reader hears for a value: "Company, Acme" or "…, empty". */
export function spoken(value: RenderedValue) {
  return `${value.label}, ${value.text ?? "empty"}`
}
