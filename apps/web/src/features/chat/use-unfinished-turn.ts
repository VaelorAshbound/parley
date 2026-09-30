import { useEffect, useEffectEvent, useState } from "react"

import type { ChatMessage } from "@/server/ai/chat"

// A page loaded while Parley was still answering (a reload mid-reply,
// PAR-33): the server saved the user's message, and saves the reply when
// the turn ends. A stream can't be resumed here (the AI SDK's resume needs a
// stream store, https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams),
// so the page reads the saved chat again until the reply is in it. A turn
// that never ends (the server stopped) is said so, with Try again.
//
// Only a turn young enough to still be running is waited for: a chat can
// end with the user's message for good (a provider error or a Stop before
// Parley's first word), and a later visit must not sit on "Thinking…". A
// message with no save time (the page's own copy, not the server's) can't
// be proven young, so it isn't waited for either.

/** How often the saved chat is read, and for how long. */
export const UNFINISHED = { everyMs: 1500, giveUpAfterMs: 60_000 }

export type UnfinishedTurn = "waiting" | "lost" | null

export function useUnfinishedTurn({
  initialMessages,
  load,
  onReply,
  timing = UNFINISHED,
}: {
  /** The chat as the page loaded it. */
  initialMessages: ChatMessage[]
  /** Reads the saved chat. */
  load: () => Promise<ChatMessage[]>
  /** The saved chat, once it has the reply. */
  onReply: (messages: ChatMessage[]) => void
  timing?: typeof UNFINISHED
}): [UnfinishedTurn, (state: UnfinishedTurn) => void] {
  // What is left of the turn's time, from when its message was saved. The
  // server's clock against this one: a skew only moves the wait's end.
  const [left] = useState(() => {
    const last = initialMessages.at(-1)
    if (last?.role !== "user") return null
    const savedAt = last.metadata?.savedAt
    if (savedAt === undefined) return 0
    return Math.min(
      timing.giveUpAfterMs,
      savedAt + timing.giveUpAfterMs - Date.now()
    )
  })
  const [state, setState] = useState<UnfinishedTurn>(() =>
    left === null ? null : left > 0 ? "waiting" : "lost"
  )
  // Not dependencies: a new callback mustn't restart the wait.
  // https://react.dev/reference/react/useEffectEvent
  const read = useEffectEvent(load)
  const answered = useEffectEvent(onReply)

  useEffect(() => {
    if (state !== "waiting") return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = Date.now() + (left ?? 0)
    const check = async () => {
      // A failed read counts as "not yet"; the next tick reads again.
      const saved = await read().catch(() => null)
      if (stopped) return
      if (saved && saved.at(-1)?.role !== "user") {
        answered(saved)
        setState(null)
        return
      }
      if (Date.now() >= deadline) {
        setState("lost")
        return
      }
      timer = setTimeout(() => void check(), timing.everyMs)
    }
    timer = setTimeout(() => void check(), timing.everyMs)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [state, timing, left])

  return [state, setState]
}
