import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { ArrowRightIcon, FileTextIcon } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { documentName } from "@/lib/documents"
import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

import { updatedLabel } from "./calendar"
import { useCalendar } from "./use-calendar"
import { useDebouncedValue } from "./use-debounced-value"

/** Results the dialog shows at most; "See all" opens /drafts for the rest. */
const RESULTS = 20

/**
 * Draft search (⌘K): titles, agreements and party names, matched from the
 * start of each word as you type (spec §5 UI: Command inside a Dialog). The
 * server searches, so the Command's own filter is off. Loaded on first use.
 */
export function SearchDialog({
  open,
  onOpenChange,
  orpc,
  calendarKey,
  showAll,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orpc: Orpc
  calendarKey: string
  /** Offer /drafts (accounts only). */
  showAll: boolean
}) {
  const navigate = useNavigate()
  const calendar = useCalendar(calendarKey)
  const hidden = useUiStore((state) => state.hidden)
  const [text, setText] = useState("")
  // Each time it opens, the search starts empty.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setText("")
  }
  const typed = text.trim()
  const query = useDebouncedValue(typed, 150)
  const results = useQuery({
    // Nothing typed: the recent drafts, which the sidebar already loaded.
    ...orpc.drafts.list.queryOptions({
      input: query ? { query, limit: RESULTS } : {},
    }),
    // The last results stay while the next ones load: no flash between keys.
    placeholderData: keepPreviousData,
    enabled: open,
  })
  const drafts = (results.data ?? [])
    .filter((draft) => !hidden[draft.id])
    .slice(0, RESULTS)

  // The highlight starts on the top result each time the results change.
  const first = drafts[0]?.id ?? ""
  const [selected, setSelected] = useState(first)
  const [listedFirst, setListedFirst] = useState(first)
  if (first !== listedFirst) {
    setListedFirst(first)
    setSelected(first)
  }

  function openDraft(draftId: string) {
    onOpenChange(false)
    void navigate({ to: "/d/$draftId", params: { draftId } })
  }

  // Until this search's results arrive (the pause, then the request), the
  // list still shows the last search's. Enter then waits and opens the top
  // result for what was typed, not an old one.
  const stale = query !== typed || results.isPlaceholderData
  const enterWaiting = useRef(false)
  const openFirst = useEffectEvent(() => {
    if (first) openDraft(first)
  })
  useEffect(() => {
    if (!open) enterWaiting.current = false
    else if (enterWaiting.current && !stale) {
      enterWaiting.current = false
      openFirst()
    }
  }, [open, stale])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search drafts"
      description="Find a draft by its name, its agreement or a party."
    >
      <Command
        shouldFilter={false}
        loop
        value={selected}
        onValueChange={setSelected}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !stale) return
          event.preventDefault()
          enterWaiting.current = true
        }}
      >
        <CommandInput
          value={text}
          onValueChange={setText}
          placeholder="Search drafts…"
          aria-label="Search drafts"
        />
        <CommandList>
          {results.isSuccess && (
            <CommandEmpty>
              {query ? `No drafts match “${query}”.` : "No drafts yet."}
            </CommandEmpty>
          )}
          {drafts.length > 0 && (
            <CommandGroup heading={query ? "Drafts" : "Recent"}>
              {drafts.map((draft) => (
                <CommandItem
                  key={draft.id}
                  value={draft.id}
                  onSelect={() => openDraft(draft.id)}
                >
                  <FileTextIcon />
                  <span className="min-w-0 flex-1 truncate">{draft.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {documentName(draft.documentId)} ·{" "}
                    {updatedLabel(draft.updatedAt, calendar)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        {showAll && (
          <Link
            to="/drafts"
            search={{ q: query || undefined }}
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 border-t px-3 py-2.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline"
          >
            {query ? "See all results" : "See all drafts"}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
      </Command>
    </CommandDialog>
  )
}
