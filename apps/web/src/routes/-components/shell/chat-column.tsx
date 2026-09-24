import { Link } from "@tanstack/react-router"
import { DISCLAIMER } from "@workspace/documents"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"

// The middle column (spec §1 Layout). The conversation and the reply box
// arrive with the AI chat (T17).
export function ChatColumn({
  title,
  panelOpen,
}: {
  title: string
  panelOpen: boolean
}) {
  return (
    <section aria-label="Chat" className="flex h-full min-w-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 pr-3 pl-5">
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {title}
        </h1>
        <Link
          to="."
          search={(prev) => ({
            ...prev,
            panel: panelOpen ? "closed" : undefined,
          })}
          aria-label={panelOpen ? "Close document" : "Open document"}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "max-md:hidden"
          )}
        >
          {panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Link>
      </header>
      <Empty className="min-h-0 flex-1">
        <EmptyHeader>
          <EmptyTitle>Tell Parley about your deal</EmptyTitle>
          <EmptyDescription>
            Who is it with, and what are you sharing or selling?
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <p className="shrink-0 px-6 pb-4 text-center text-xs text-muted-foreground">
        {DISCLAIMER}
      </p>
    </section>
  )
}
