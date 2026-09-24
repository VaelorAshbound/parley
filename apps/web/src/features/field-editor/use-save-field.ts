import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  applyFieldChanges,
  definitionOf,
  type ChangeIssue,
} from "@workspace/documents"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

import type { Inputs } from "./model"

// Saving one field (spec §5 API: drafts.updateFields). The document shows the
// change at once (an optimistic update, computed by the same engine as the
// server), and the editor closes. If the server refuses it, or can't be
// reached, the draft goes back to the server's copy and the editor opens again
// with what was typed and why (T16).
// https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

const OFFLINE = "We couldn't save that. Check your connection and try again."

type Save = { fieldKey: string; change: unknown; inputs: Inputs }

export function useSaveField(orpc: Orpc, draftId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setRefused = useUiStore((state) => state.setRefused)
  const draftKey = orpc.drafts.get.queryKey({ input: { id: draftId } })
  const mutationKey = orpc.drafts.updateFields.mutationKey()

  const reopen = ({ fieldKey, inputs }: Save, issues: ChangeIssue[]) => {
    setRefused({ draftId, fieldKey, inputs, issues })
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, field: fieldKey }),
      replace: true,
    })
  }

  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ fieldKey, change }: Save) =>
      orpc.drafts.updateFields.call({
        id: draftId,
        changes: [{ key: fieldKey, value: change }],
      }),
    // One draft's saves run in order, so a later edit never lands first.
    // A save waiting its turn is already on screen (see below).
    scope: { id: `draft-${draftId}` },
    onSuccess: (result, save) => {
      const [refused] = result.rejected
      // Saves still waiting would be undone by this older copy; the last
      // one to finish brings the server's copy.
      if (refused || queryClient.isMutating({ mutationKey }) <= 1)
        queryClient.setQueryData(draftKey, result.draft)
      if (refused) reopen(save, refused.issues)
    },
    onError: (_error, save) => {
      void queryClient.invalidateQueries({ queryKey: draftKey })
      reopen(save, [{ path: [], message: OFFLINE }])
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: orpc.drafts.list.key() }),
  })

  return (save: Save) => {
    // The edit shows at once. Not in onMutate: a save queued behind a slow
    // one only runs its onMutate when its turn comes.
    void queryClient.cancelQueries({ queryKey: draftKey })
    const draft = queryClient.getQueryData(draftKey)
    if (draft) {
      const definition = definitionOf(draft.documentId)
      const { values } = applyFieldChanges(
        definition,
        definition.draftSchema.parse(draft.fields),
        [{ key: save.fieldKey, value: save.change }]
      )
      queryClient.setQueryData(draftKey, { ...draft, fields: values })
    }
    mutation.mutate(save)
  }
}
