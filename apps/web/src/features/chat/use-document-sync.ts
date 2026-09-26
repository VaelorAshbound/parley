import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"

// The live document follows the chat (spec §8: a field changes within 100 ms
// of the tool result arriving). Each finished tool call is applied to the
// draft the page shows, once; the server already saved it.

export function useDocumentSync(
  orpc: Orpc,
  draftId: string,
  messages: ChatMessage[]
) {
  const queryClient = useQueryClient()
  const markChanged = useUiStore((state) => state.markChanged)
  const draftKey = orpc.drafts.get.queryKey({ input: { id: draftId } })
  // Tool calls already on the page when it loaded are in the draft already.
  const [done] = useState(
    () => new Set(finishedCalls(messages).map((call) => call.toolCallId))
  )

  useEffect(() => {
    for (const part of finishedCalls(messages)) {
      if (done.has(part.toolCallId)) continue
      done.add(part.toolCallId)
      if (part.type === "tool-chooseDocument") {
        // A new agreement changes every field: load the draft again.
        void queryClient.invalidateQueries({ queryKey: draftKey })
        void queryClient.invalidateQueries({
          queryKey: orpc.drafts.list.key(),
        })
        continue
      }
      queryClient.setQueryData(draftKey, (draft) => {
        if (!draft) return draft
        const fields = { ...draft.fields }
        for (const change of part.output.applied) {
          if (change.after === undefined) delete fields[change.key]
          else fields[change.key] = change.after
        }
        return { ...draft, fields }
      })
      // The changed fields ink in, and the panel scrolls to the first.
      markChanged(part.output.applied.map((change) => change.key))
    }
  }, [messages, queryClient, draftKey, orpc, done, markChanged])
}

function finishedCalls(messages: ChatMessage[]) {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      (part.type === "tool-updateFields" ||
        part.type === "tool-chooseDocument") &&
      part.state === "output-available"
        ? [part]
        : []
    )
  )
}
