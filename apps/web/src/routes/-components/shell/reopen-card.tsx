import { Link } from "@tanstack/react-router"
import type { DocumentId } from "@workspace/documents"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { PanelRightOpenIcon } from "lucide-react"
import { useId } from "react"

import { documentName } from "@/lib/documents"

/**
 * The way back to a closed document panel (spec §1 Layout, PAR-44): a card
 * at the top of the chat with the agreement's name and "Open document".
 * Only on wider screens (a phone has the Document tab, so CSS hides it and
 * the server renders the same thing), and only once an agreement is picked.
 */
export function ReopenCard({
  panelOpen,
  documentId,
  onOpen,
}: {
  panelOpen: boolean
  documentId: DocumentId | null
  /** Called on open, to move focus: this card goes away with the click. */
  onOpen?: () => void
}) {
  const labelId = useId()
  const nameId = useId()
  if (panelOpen || documentId === null) return null

  return (
    <div className="enter mx-auto w-full max-w-2xl shrink-0 px-5 pt-1 max-md:hidden md:px-8">
      <div
        // A name and one button: a group, so a screen reader says which
        // document the button opens.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="group"
        aria-labelledby={labelId}
        className="flex items-center gap-3.5 rounded-[18px] bg-card py-2.5 pr-2.5 pl-3 shadow-float"
      >
        <SheetThumb />
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-label text-ink-3 uppercase">
            Document closed
          </p>
          <p
            id={nameId}
            className="mt-0.5 truncate font-serif text-[15.5px] leading-snug font-medium tracking-[-0.005em]"
          >
            {documentName(documentId)}
          </p>
        </div>
        <Link
          to="."
          search={(prev) => ({ ...prev, panel: undefined })}
          onClick={onOpen}
          aria-describedby={nameId}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "shrink-0 rounded-full"
          )}
        >
          <PanelRightOpenIcon data-icon="inline-start" aria-hidden="true" />
          Open document
        </Link>
      </div>
    </div>
  )
}

// A tiny page of the agreement: black lines of contract and one blue line,
// a value filled in (brand.md: black type is the agreement, blue is yours).
function SheetThumb() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-9 shrink-0 flex-col gap-[3px] rounded-[3px] bg-sheet px-[6px] pt-[7px] shadow-sheet"
    >
      <span className="h-[2px] w-3/5 rounded-full bg-foreground/70" />
      <span className="h-px w-full bg-ink-4/60" />
      <span className="h-px w-full bg-ink-4/60" />
      <span className="h-[2px] w-2/3 rounded-full bg-blue-ink" />
      <span className="h-px w-4/5 bg-ink-4/60" />
    </span>
  )
}
