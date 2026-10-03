import { useChat } from "@ai-sdk/react"
import { ORPCError } from "@orpc/client"
import { useQueryClient } from "@tanstack/react-query"
import type { DocumentDefinition } from "@workspace/documents"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Marker, MarkerContent } from "@workspace/ui/components/marker"
import { cn } from "@workspace/ui/lib/utils"
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
import { useEffect, useRef, useState } from "react"

import { ChatWelcome } from "@/features/empty-state/chat-welcome"
import { DownloadButton } from "@/features/export/download"
import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"
import { ProblemNote } from "@/components/problem-note"
import type { ChatMessage } from "@/server/ai/chat"
import type { Answers } from "@/server/ai/questions"

import { Composer } from "./composer"
import { limitProblem } from "./limit-problem"
import {
  isStopped,
  MessageParts,
  PlainText,
  StoppedNote,
} from "./message-parts"
import { forgetSettledQuestions } from "./ai-questionnaire"
import { answersToRetry, questionsAnswered } from "./transport"
import { useDocumentSync } from "./use-document-sync"
import { useUnfinishedTurn } from "./use-unfinished-turn"
import { useUndo } from "./use-undo"

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
  const {
    messages,
    sendMessage,
    addToolOutput,
    status,
    stop,
    error,
    regenerate,
    setMessages,
    clearError,
  } = useChat<ChatMessage>({
    id: draftId,
    messages: initialMessages,
    transport,
    // Answers to the AI's questions go back as soon as they are given.
    sendAutomaticallyWhen: questionsAnswered,
    // The next visit to this draft starts from the whole chat, and the
    // sidebar's order from this turn. Answers the server took no longer
    // need keeping for a reload.
    onFinish: ({ messages: finished, isError, isAbort }) => {
      if (!isError) forgetSettledQuestions(finished.at(-1))
      // Stopped here: marked as the server saves it, so it reads the same
      // now as after a reload (PAR-47).
      const all = isAbort ? markStopped(finished) : finished
      if (all !== finished) setMessages(all)
      queryClient.setQueryData(
        orpc.chat.messages.queryKey({ input: { id: draftId } }),
        all
      )
      void queryClient.invalidateQueries({
        queryKey: orpc.drafts.list.key(),
      })
    },
    // The server refused the answers, or the questions had closed: its copy
    // of the chat is the truth, so the questionnaire comes back (with what
    // was typed, still saved) instead of a dead end.
    onError: (failure) => {
      if (
        !(failure instanceof ORPCError) ||
        (failure.code !== "INVALID_ANSWERS" && failure.code !== "NOT_OPEN")
      )
        return
      void orpc.chat.messages.call({ id: draftId }).then((fresh) => {
        setMessages(fresh)
        clearError()
      })
    },
  })
  // Loaded mid-reply (a reload): the reply shows once the server saves it.
  const [unfinished, setUnfinished] = useUnfinishedTurn({
    initialMessages,
    load: () =>
      queryClient.fetchQuery({
        ...orpc.chat.messages.queryOptions({ input: { id: draftId } }),
        staleTime: 0,
      }),
    onReply: (saved) => {
      setMessages(saved)
      void queryClient.invalidateQueries({ queryKey: orpc.drafts.list.key() })
    },
  })
  const waiting = unfinished === "waiting"
  const busy = status === "submitted" || status === "streaming" || waiting
  // Try again: a failed answer turn sends the answers again; any other turn
  // sends the user's last message again, which the server takes as a retry
  // of it (PAR-7).
  const retry = () => {
    setUnfinished(null)
    const last = messages.at(-1)
    const answered = last ? answersToRetry(last) : null
    if (!answered) {
      void regenerate()
      return
    }
    setMessages([...messages.slice(0, -1), answered])
    void sendMessage(undefined, { body: { retry: true } })
  }
  // A limit reached (spec §2 Limits) says so, with the way past it.
  const limit = error ? limitProblem(error, `/d/${draftId}`) : null
  const pending = useUiStore((state) => state.pending)
  const setPending = useUiStore((state) => state.setPending)
  const settle = useUiStore((state) => state.settle)
  const reply = useRef<HTMLTextAreaElement>(null)
  // A new message settles the last turn's highlights in the document.
  const send = (text: string) => {
    settle()
    void sendMessage({ text })
  }
  const answer = ({
    toolCallId,
    answers,
  }: {
    toolCallId: string
    answers: Answers
  }) => {
    settle()
    // Answers to a stopped reply carry it on: it isn't stopped any more.
    const last = messages.at(-1)
    if (last && isStopped(last.parts))
      setMessages([
        ...messages.slice(0, -1),
        { ...last, parts: unmarked(last) },
      ])
    void addToolOutput({
      tool: "askQuestions",
      toolCallId,
      output: { answers },
    })
    // The questionnaire goes, and focus with it: the reply box is next, not
    // the top of the page (T36). A touch screen keeps its keyboard closed
    // for reading the reply.
    if (!matchMedia("(pointer: coarse)").matches)
      reply.current?.focus({ preventScroll: true })
  }

  const [loaded] = useState(
    () => new Set(initialMessages.map((message) => message.id))
  )
  useDocumentSync(orpc, draftId, messages)
  const undo = useUndo(orpc, draftId)

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
          {/* The scroller hides the chat until it has scrolled to the end,
              which on a server-rendered page means until the scripts run: a
              phone's LCP waited 4 s for it (T35). An empty chat has nothing
              to scroll, so its welcome shows with the HTML. */}
          <MessageScrollerViewport
            className={cn(
              initialMessages.length === 0 && "data-pending-scroll:visible"
            )}
          >
            <MessageScrollerContent className="mx-auto w-full max-w-2xl gap-5 px-5 pt-6 pb-4 md:px-8">
              {messages.length === 0 && !pending ? (
                <ChatWelcome document={definition?.name ?? null} />
              ) : null}
              {messages.map((message, index) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  // Only this visit's turns anchor. The scroller never marks
                  // the turns there on load as handled, so a change that
                  // keeps the item count (a note replacing "Thinking…")
                  // scrolled to the first of them, the top (PAR-34).
                  scrollAnchor={
                    message.role === "user" && !loaded.has(message.id)
                  }
                  // New messages rise in; the ones there on load don't move.
                  className={cn(!loaded.has(message.id) && "enter")}
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
                          onUndo={undo}
                          download={
                            <DownloadButton orpc={orpc} draftId={draftId} />
                          }
                          last={index === messages.length - 1}
                          onAnswer={
                            index === messages.length - 1 && !busy
                              ? answer
                              : undefined
                          }
                          stopped={isStopped(message.parts)}
                        />
                        {isStopped(message.parts) &&
                        !(busy && index === messages.length - 1) ? (
                          <StoppedNote
                            className={cn(!loaded.has(message.id) && "enter")}
                            // Only the latest turn can be tried again, and
                            // not twice: a failed retry says so itself.
                            onRetry={
                              index === messages.length - 1 &&
                              !error &&
                              unfinished !== "lost"
                                ? retry
                                : undefined
                            }
                          />
                        ) : null}
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
              {(status === "submitted" || waiting) && (
                <Marker render={<output />}>
                  <MarkerContent className="shimmer">Thinking…</MarkerContent>
                </Marker>
              )}
              {limit ? (
                <ProblemNote
                  problem={limit}
                  onRetry={limit.retry ? retry : undefined}
                />
              ) : error || unfinished === "lost" ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between gap-3">
                    Parley couldn’t answer. Please try again.
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={retry}
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto w-full max-w-2xl shrink-0 px-5 pt-1 md:px-8">
        <Composer
          busy={busy}
          onSend={send}
          // Nothing to stop from here while another page's turn ends.
          onStop={waiting ? undefined : () => void stop()}
          inputRef={reply}
        />
      </div>
    </div>
  )
}

/**
 * The chat with its last reply marked stopped (PAR-47), as the server saves
 * one cut short: only a reply with something in it, since a reply stopped
 * before its first word isn't kept. The same chat when there's none.
 */
function markStopped(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.at(-1)
  if (last?.role !== "assistant" || isStopped(last.parts)) return messages
  const said = last.parts.some(
    (part) =>
      part.type !== "step-start" &&
      !(
        (part.type === "text" || part.type === "reasoning") &&
        part.text.trim() === ""
      )
  )
  if (!said) return messages
  return [
    ...messages.slice(0, -1),
    { ...last, parts: [...last.parts, { type: "data-interrupted", data: {} }] },
  ]
}

/** The reply's parts without a Stopped mark. */
function unmarked(message: ChatMessage) {
  return message.parts.filter((part) => part.type !== "data-interrupted")
}
