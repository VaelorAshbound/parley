import { useQueryClient } from "@tanstack/react-query"
import {
  definitionOf,
  isDocumentId,
  switchDocument,
} from "@workspace/documents"
import { useEffect, useState } from "react"
import { Temporal } from "temporal-polyfill"

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
        // A different agreement shows at once, with the values the server
        // kept (the same switchDocument it ran). Waiting for the draft load
        // below held back the field the AI fills next by the load's whole
        // round trip: 130-400 ms instead of ~30 (PAR-55). The same one
        // again changes nothing on screen: the load is enough.
        const { documentId } = part.output
        if (isDocumentId(documentId))
          queryClient.setQueryData(draftKey, (draft) =>
            draft && draft.documentId !== documentId
              ? {
                  ...draft,
                  documentId,
                  fields: switchDocument(
                    draft.fields,
                    definitionOf(documentId),
                    { today: Temporal.Now.plainDateISO().toString() }
                  ),
                }
              : draft
          )
        // The rest of the draft (title, status) comes with a fresh load.
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
      // A draft load still on its way (the one chooseDocument starts) read
      // the database before this change was saved, and would put the old
      // values back when it lands (PAR-32). Drop it and load again: the
      // server saved this change before sending its result. Cancelling keeps
      // the value set just above: TanStack Query rolls a cancelled load back
      // to the last setQueryData, not to the answer before it.
      if (queryClient.isFetching({ queryKey: draftKey }) > 0) {
        void queryClient
          .cancelQueries({ queryKey: draftKey })
          .then(() => queryClient.invalidateQueries({ queryKey: draftKey }))
      }
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
