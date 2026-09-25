import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  applyFieldChanges,
  definitionOf,
  type ChangeRequest,
} from "@workspace/documents"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

// Undo for one AI change (spec §1 story 5). The change set's inverse carries
// the value it expects, so an undo never overwrites a newer edit (ADR-0003:
// compare-and-set); if the field changed since, the row says so instead.

type Undo = {
  /** "toolCallId:field", the row in the chat. */
  row: string
  change: ChangeRequest
}

export function useUndo(orpc: Orpc, draftId: string) {
  const queryClient = useQueryClient()
  const setUndo = useUiStore((state) => state.setUndo)
  const markChanged = useUiStore((state) => state.markChanged)
  const draftKey = orpc.drafts.get.queryKey({ input: { id: draftId } })
  const mutationKey = orpc.drafts.updateFields.mutationKey()

  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ change }: Undo) =>
      orpc.drafts.updateFields.call({ id: draftId, changes: [change] }),
    // In line with the draft's other saves.
    scope: { id: `draft-${draftId}` },
    onSuccess: (result, { row }) => {
      if (queryClient.isMutating({ mutationKey }) <= 1)
        queryClient.setQueryData(draftKey, result.draft)
      if (result.rejected.length > 0) setUndo(row, "stale")
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: draftKey }),
  })

  return ({ row, change }: Undo) => {
    const draft = queryClient.getQueryData(draftKey)
    if (!draft?.documentId) return
    const definition = definitionOf(draft.documentId)
    const { values, rejected } = applyFieldChanges(
      definition,
      definition.draftSchema.parse(draft.fields),
      [change]
    )
    // Changed since the AI's edit: nothing to undo, say so at once.
    if (rejected.length > 0) {
      setUndo(row, "stale")
      return
    }
    void queryClient.cancelQueries({ queryKey: draftKey })
    queryClient.setQueryData(draftKey, { ...draft, fields: values })
    setUndo(row, "undone")
    markChanged([change.key])
    mutation.mutate({ row, change })
  }
}
