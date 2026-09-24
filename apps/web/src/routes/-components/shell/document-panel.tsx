import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { FileTextIcon, XIcon } from "lucide-react"

// The right panel (spec §1 Layout): the live document. T16 renders the
// document itself; T24 and T25 add Download and Share.
export function DocumentPanel({ name }: { name: string }) {
  return (
    <section
      aria-label="Live document"
      className="flex h-full min-w-0 flex-col bg-paper-deep"
    >
      <header className="flex h-14 shrink-0 items-center gap-1.5 pr-3 pl-4">
        <FileTextIcon className="size-4 text-ink-2" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name}
        </h2>
        <Link
          to="."
          search={(prev) => ({ ...prev, panel: "closed" })}
          aria-label="Close document"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "max-md:hidden"
          )}
        >
          <XIcon />
        </Link>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-12 md:px-9">
        <article className="mx-auto min-h-[70svh] max-w-[552px] rounded-sm bg-sheet px-8 py-12 shadow-sheet md:px-13">
          <p className="text-label text-muted-foreground uppercase">
            Cover page
          </p>
          <p className="mt-3.5 font-serif text-[26px] leading-tight font-medium tracking-[-0.012em]">
            {name}
          </p>
        </article>
      </div>
    </section>
  )
}
