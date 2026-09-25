import { useChat } from "@ai-sdk/react"
import { useQueryClient } from "@tanstack/react-query"
import type { DocumentDefinition } from "@workspace/documents"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Marker, MarkerContent } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import type { ChatTransport } from "ai"
import { useEffect } from "react"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"

import { Composer } from "./composer"
import { MessageParts, PlainText } from "./message-parts"
import { useDocumentSync } from "./use-document-sync"

// The conversation (spec §1 Middle: chat): the shadcn chat primitives, fed by
// useChat. The scroller follows the stream and anchors each of the user's
// turns; the document panel follows the tool results (useDocumentSync).

export function ChatPanel({
  draftId,
  initialMessages,
  definition,
  transport,
  orpc,
}: {
  draftId: string
  initialMessages: ChatMessage[]
  definition: DocumentDefinition | null
  transport: ChatTransport<ChatMessage>
  orpc: Orpc
}) {
  const queryClient = useQueryClient()
  const { messages, sendMessage, status, stop, error, regenerate } =
    useChat<ChatMessage>({
      id: draftId,
      messages: initialMessages,
      transport,
      // The next visit to this draft starts from the whole chat, and the
      // sidebar's order from this turn.
      onFinish: ({ messages: all }) => {
        queryClient.setQueryData(
          orpc.chat.messages.queryKey({ input: { id: draftId } }),
          all
        )
        void queryClient.invalidateQueries({
          queryKey: orpc.drafts.list.key(),
        })
      },
    })
  const busy = status === "submitted" || status === "streaming"
  const pending = useUiStore((state) => state.pending)
  const setPending = useUiStore((state) => state.setPending)

  useDocumentSync(orpc, draftId, messages)

  // The first message, typed on the home page before this draft existed.
  useEffect(() => {
    if (pending?.draftId !== draftId) return
    setPending(null)
    void sendMessage({ text: pending.text })
  }, [pending, draftId, setPending, sendMessage])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-5 px-5 pt-6 pb-4 md:px-8">
              {messages.length === 0 && !pending ? (
                <Empty className="my-auto">
                  <EmptyHeader>
                    <EmptyTitle>Tell Parley about your deal</EmptyTitle>
                    <EmptyDescription>
                      Who is it with, and what are you sharing or selling?
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  {message.role === "user" ? (
                    <Message align="end">
                      <Bubble variant="secondary" align="end">
                        <BubbleContent className="rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px]">
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <PlainText key={index} text={part.text} />
                            ) : null
                          )}
                        </BubbleContent>
                      </Bubble>
                    </Message>
                  ) : (
                    <Message align="start">
                      <MessageContent className="gap-3.5">
                        <MessageParts
                          parts={message.parts}
                          definition={definition}
                        />
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
              {status === "submitted" && (
                <Marker render={<output />}>
                  <MarkerContent className="shimmer">Thinking…</MarkerContent>
                </Marker>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between gap-3">
                    Parley couldn’t answer. Please try again.
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void regenerate()}
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto w-full max-w-2xl shrink-0 px-5 pt-1 md:px-8">
        <Composer
          busy={busy}
          onSend={(text) => void sendMessage({ text })}
          onStop={() => void stop()}
        />
      </div>
    </div>
  )
}
