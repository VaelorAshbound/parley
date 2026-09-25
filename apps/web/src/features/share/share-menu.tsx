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
import { ChevronDownIcon, Link2OffIcon, LinkIcon } from "lucide-react"
import { useState } from "react"

import type { Orpc } from "@/lib/orpc"

import { useShare } from "./use-share"

// Share in the document panel's header (spec §1 Layout; T25), a menu like
// Download: copy the draft's read-only link, and turn it off while it is on.

export function ShareMenu({ orpc, draftId }: { orpc: Orpc; draftId: string }) {
  const share = useShare(orpc, draftId)
  const [open, setOpen] = useState(false)
  // Read when the menu opens; hovering the button loads it just before.
  const { data: link } = useQuery({ ...share.link, enabled: open })
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            onPointerEnter={share.prefetch}
            onFocus={share.prefetch}
          />
        }
      >
        <LinkIcon data-icon="inline-start" />
        Share
        <ChevronDownIcon data-icon="inline-end" className="text-ink-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            {link
              ? "Anyone with the link can read this draft. Your chat stays private."
              : "A read-only link to this draft. Your chat stays private."}
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
