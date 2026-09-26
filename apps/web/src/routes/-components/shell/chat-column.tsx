import { CatchBoundary, Link, useRouteContext } from "@tanstack/react-router"
import { DISCLAIMER, definitionOf, type DocumentId } from "@workspace/documents"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronDownIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react"
import { useState } from "react"

import { ChatPanel } from "@/features/chat/chat-panel"
import { chatTransport } from "@/features/chat/transport"
import { DraftMenu } from "@/features/drafts/draft-menu"
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
  const { orpc, viewer } = useRouteContext({ from: "/_app/d/$draftId" })
  const [transport] = useState(() => chatTransport(orpc))

  return (
    <section aria-label="Chat" className="flex h-full min-w-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 pr-3 pl-3">
        {/* The title is its own menu: rename, duplicate, delete (spec §1). */}
        <h1 className="flex min-w-0 flex-1 text-[15px] font-semibold">
          <DraftMenu
            draft={{ id: draft.id, title }}
            orpc={orpc}
            canDuplicate={viewer !== null && !viewer.isAnonymous}
            render={
              <Button
                variant="ghost"
                className="max-w-full min-w-0 justify-start px-2 text-[15px] font-semibold"
              />
            }
          >
            <span className="truncate">{title}</span>
            <ChevronDownIcon
              data-icon="inline-end"
              aria-hidden="true"
              className="text-muted-foreground"
            />
          </DraftMenu>
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
      {/* A failure in the chat never takes the page down with it (spec §5
          Routing); another draft starts clean. */}
      <CatchBoundary
        getResetKey={() => draft.id}
        errorComponent={({ reset }) => (
          <Alert variant="destructive" className="m-5 w-auto">
            <AlertDescription className="flex items-center justify-between gap-3">
              The chat stopped working.
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
      >
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
      </CatchBoundary>
      <p className="shrink-0 px-6 pt-2 pb-4 text-center text-xs text-muted-foreground">
        {DISCLAIMER}
      </p>
    </section>
  )
}
