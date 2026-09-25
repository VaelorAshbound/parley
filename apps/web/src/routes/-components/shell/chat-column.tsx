import { Link, useRouteContext } from "@tanstack/react-router"
import { DISCLAIMER, definitionOf, type DocumentId } from "@workspace/documents"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import { useState } from "react"

import { ChatPanel } from "@/features/chat/chat-panel"
import { chatTransport } from "@/features/chat/transport"
import type { ChatMessage } from "@/server/ai/chat"

// The middle column (spec §1 Layout): the draft's title, the conversation,
// and the reply box with the demo note under it.
export function ChatColumn({
  title,
  panelOpen,
  draft,
  messages,
}: {
  title: string
  panelOpen: boolean
  draft: { id: string; documentId: DocumentId | null }
  messages: ChatMessage[]
}) {
  const { orpc } = useRouteContext({ from: "/_app/d/$draftId" })
  const [transport] = useState(() => chatTransport(orpc))

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
      <ChatPanel
        // A fresh chat per draft: useChat keeps its messages by id.
        key={draft.id}
        draftId={draft.id}
        initialMessages={messages}
        definition={
          draft.documentId === null ? null : definitionOf(draft.documentId)
        }
        transport={transport}
        orpc={orpc}
      />
      <p className="shrink-0 px-6 pt-2 pb-4 text-center text-xs text-muted-foreground">
        {DISCLAIMER}
      </p>
    </section>
  )
}
