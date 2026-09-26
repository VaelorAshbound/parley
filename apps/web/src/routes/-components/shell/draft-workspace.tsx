import { useNavigate } from "@tanstack/react-router"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, type ComponentProps } from "react"
import { usePanelRef, type Layout } from "react-resizable-panels"

import { writeCookie } from "@/lib/browser-cookies"
import { useUiStore } from "@/lib/ui-store"

import type { ChatMessage } from "@/server/ai/chat"

import { ChatColumn } from "./chat-column"
import { DocumentPanel } from "./document-panel"
import { layoutCookie } from "./layout"

/**
 * Chat and document side by side, resizable, on desktop; two tabs on a phone
 * (spec §1 Layout). One tree for both, switched by CSS breakpoints, so the
 * server renders exactly what the browser shows (no layout shift).
 */
export function DraftWorkspace({
  title,
  documentName,
  draft,
  messages,
  editing,
  panelOpen,
  tab,
  layout,
}: {
  title: string
  documentName: string
  draft: ComponentProps<typeof DocumentPanel>["draft"]
  messages: ChatMessage[]
  editing: string | undefined
  panelOpen: boolean
  tab: "chat" | "document"
  layout: Layout
}) {
  const navigate = useNavigate()
  const documentPanel = usePanelRef()
  // Phones show one pane at a time (CSS below), so sizes and collapsing only
  // apply on wider screens.
  const isMobile = useIsMobile()
  // On a phone the Document tab shows a dot when the AI changed the document
  // while the chat was open (spec §1 Phone).
  const unseen = useUiStore((state) => state.unseen)
  const seeDocument = useUiStore((state) => state.seeDocument)
  useEffect(() => {
    if (tab === "document" || !isMobile) seeDocument()
  }, [tab, isMobile, unseen, seeDocument])

  // The URL decides open or closed; the panel follows it.
  useEffect(() => {
    const panel = documentPanel.current
    if (!panel || isMobile) return
    if (panelOpen && panel.isCollapsed()) panel.expand()
    if (!panelOpen && !panel.isCollapsed()) panel.collapse()
  }, [panelOpen, documentPanel, isMobile])

  return (
    <div className="flex h-svh flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:hidden">
        <SidebarTrigger />
        <ToggleGroup
          aria-label="Show"
          value={[tab]}
          onValueChange={(value: string[]) => {
            const next = value[0] === "document" ? "document" : "chat"
            void navigate({
              to: ".",
              search: (prev) => ({
                ...prev,
                tab: next === "chat" ? undefined : next,
              }),
            })
          }}
          className="ml-auto"
        >
          <ToggleGroupItem value="chat">Chat</ToggleGroupItem>
          <ToggleGroupItem value="document">
            Document
            {unseen && tab === "chat" && (
              <>
                <span
                  aria-hidden="true"
                  className="enter size-1.5 rounded-full bg-blue-ink"
                />
                <span className="sr-only">(changed)</span>
              </>
            )}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ResizablePanelGroup
        id="draft"
        defaultLayout={panelOpen ? layout : { chat: 100, document: 0 }}
        disabled={isMobile}
        onLayoutChanged={(next, meta) => {
          // Only what the user did by hand is remembered.
          if (meta.isUserInteraction && next.document !== 0)
            writeCookie(layoutCookie, JSON.stringify(next))
        }}
        // On a phone only the open tab's panel shows, at full width. These
        // rules sit on the group because a Panel's className lands on its
        // inner div, not on the flex item that holds its size (v4).
        className={cn(
          "min-h-0 flex-1 max-md:*:data-panel:!flex-[1_1_0%]",
          tab === "document"
            ? "max-md:[&>#chat]:!hidden"
            : "max-md:[&>#document]:!hidden"
        )}
      >
        <ResizablePanel id="chat" minSize={isMobile ? undefined : 360}>
          <ChatColumn
            title={title}
            panelOpen={panelOpen}
            draft={draft}
            messages={messages}
          />
        </ResizablePanel>
        <ResizableHandle className="max-md:hidden" />
        <ResizablePanel
          id="document"
          panelRef={documentPanel}
          minSize={isMobile ? undefined : 420}
          collapsible={!isMobile}
          collapsedSize={0}
          onResize={(size) => {
            // Dragged shut: record it in the URL like the close button does.
            if (size.asPercentage === 0 && panelOpen && !isMobile)
              void navigate({
                to: ".",
                search: (prev) => ({ ...prev, panel: "closed" }),
              })
          }}
        >
          <DocumentPanel name={documentName} draft={draft} editing={editing} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
