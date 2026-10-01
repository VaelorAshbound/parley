import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDownIcon, Link2OffIcon, LinkIcon } from "lucide-react"
import { useState } from "react"

import {
  barButton,
  type Placement,
} from "@/features/document-preview/placement"
import type { Orpc } from "@/lib/orpc"

import { shareUrl, useShare } from "./use-share"

// Share in the document panel's header (spec §1 Layout; T25), a menu like
// Download: copy the draft's read-only link, and turn it off while it is on.

export function ShareMenu({
  orpc,
  draftId,
  placement = "header",
}: {
  orpc: Orpc
  draftId: string
  /** The panel header, or the phone's bottom bar (it opens upward). */
  placement?: Placement
}) {
  const share = useShare(orpc, draftId)
  const [open, setOpen] = useState(false)
  // Read when the menu opens; hovering the button loads it just before.
  const { data: link } = useQuery({ ...share.link, enabled: open })
  const bar = placement === "bar"
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(bar && [barButton, "bg-card"])}
            onPointerEnter={share.prefetch}
            onFocus={share.prefetch}
          />
        }
      >
        <LinkIcon data-icon="inline-start" />
        Share
        {!bar && (
          <ChevronDownIcon data-icon="inline-end" className="text-ink-3" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={bar ? "center" : "end"}
        side={bar ? "top" : "bottom"}
        sideOffset={bar ? 8 : 4}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            {link
              ? "Anyone with the link can read this draft. Your chat stays private."
              : "A read-only link to this draft. Your chat stays private."}
            {/* One tap selects it, for when the browser won't copy. */}
            {link && (
              <span className="mt-1.5 block font-mono text-xs break-all text-ink-2 select-all">
                {shareUrl(link.token)}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void share.copyLink()}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          {link && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void share.stopSharing()}
            >
              <Link2OffIcon />
              Stop sharing
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
