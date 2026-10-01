import type { RenderedValue } from "@workspace/documents"
import { cn } from "@workspace/ui/lib/utils"
import { createContext, useContext } from "react"

// A field's value in the live document (brand.md → A field's life): blue ink
// when filled, a dashed chip with the field's name while empty. Never a blank
// line: the PDF prints the same empty value as "[Name]".

/** The short name an empty chip shows: "Party 1: Company" → "Company". */
export function shortLabel(label: string) {
  return label.slice(label.lastIndexOf(": ") + 1).trim()
}

/**
 * Fields the AI changed this turn, each with a count that grows per change
 * (UI store `changed`). A changed value inks in; a new count replays it.
 */
export const ChangedContext = createContext<Readonly<Record<string, number>>>(
  {}
)

export function useChanged(path: string | undefined) {
  const changed = useContext(ChangedContext)
  return path === undefined ? undefined : changed[path.replace(/\..*$/s, "")]
}

export function Value({
  value,
  className,
}: {
  value: RenderedValue
  className?: string
}) {
  const inked = useChanged(value.field)
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
      // A new change remounts the value, which replays its ink-in.
      key={inked}
      data-field={value.field}
      className={cn(
        "whitespace-pre-line text-blue-ink",
        inked !== undefined && "ink-in",
        className
      )}
    >
      {value.text}
    </span>
  )
}

/** The words a screen reader hears for a value: "Company, Acme" or "…, empty". */
export function spoken(value: RenderedValue) {
  return `${value.label}, ${value.text ?? "empty"}`
}
