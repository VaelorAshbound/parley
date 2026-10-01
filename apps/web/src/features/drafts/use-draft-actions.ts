import { useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { useMatchRoute, useRouter } from "@tanstack/react-router"
import { toast } from "@workspace/ui/components/toast"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

// Rename, duplicate and delete, the same from the sidebar, the title menu
// and /drafts (spec §1 Layout). Each is a plain call, not a useMutation, so
// it still finishes when the menu that started it has gone (a deleted
// draft's row unmounts at once).

/** How long a deleted draft can be brought back (Base UI pauses it on hover). */
export const UNDO_MS = 6000

export type DraftRef = { id: string; title: string }

/** A list of drafts as the caches hold it: one page, or all loaded pages. */
type Listed<T> = T[] | InfiniteData<T[]>

export function useDraftActions(orpc: Orpc) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const matchRoute = useMatchRoute()
  const hide = useUiStore((state) => state.hide)
  const unhide = useUiStore((state) => state.unhide)

  const refreshLists = () =>
    queryClient.invalidateQueries({ queryKey: orpc.drafts.list.key() })
  const isOpen = (id: string) =>
    matchRoute({ to: "/d/$draftId", params: { draftId: id } }) !== false
  const failed = (title: string) =>
    toast.add({ type: "error", title, description: "Please try again." })

  /** Shows the new title everywhere at once; the server's copy follows. */
  async function rename(draft: DraftRef, title: string) {
    const retitle = <T extends DraftRef>(each: T) =>
      each.id === draft.id ? { ...each, title } : each
    queryClient.setQueryData(
      orpc.drafts.get.queryKey({ input: { id: draft.id } }),
      (saved) => saved && retitle(saved)
    )
    queryClient.setQueriesData<Listed<DraftRef>>(
      { queryKey: orpc.drafts.list.key() },
      (listed) => listed && mapListed(listed, retitle)
    )
    try {
      const saved = await orpc.drafts.rename.call({ id: draft.id, title })
      queryClient.setQueryData(
        orpc.drafts.get.queryKey({ input: { id: draft.id } }),
        (cached) => cached && { ...cached, ...saved }
      )
    } catch {
      failed("We couldn’t rename the draft")
      await queryClient.invalidateQueries({
        queryKey: orpc.drafts.get.key({ input: { id: draft.id } }),
      })
    } finally {
      await refreshLists()
    }
  }

  /** Makes a copy and opens it. */
  async function duplicate(draft: DraftRef) {
    try {
      const copy = await orpc.drafts.duplicate.call({ id: draft.id })
      queryClient.setQueryData(
        orpc.drafts.get.queryKey({ input: { id: copy.id } }),
        copy
      )
      queryClient.setQueryData(
        orpc.chat.messages.queryKey({ input: { id: copy.id } }),
        []
      )
      void refreshLists()
      await router.navigate({
        to: "/d/$draftId",
        params: { draftId: copy.id },
      })
    } catch {
      failed("We couldn’t copy the draft")
    }
  }

  /**
   * Hides the draft at once and offers Undo. The delete reaches the server
   * only when the toast closes without an undo; closing the tab before then
   * keeps the draft (the safe side).
   */
  function remove(draft: DraftRef) {
    const wasOpen = isOpen(draft.id)
    hide(draft.id)
    if (wasOpen) void router.navigate({ to: "/" })
    let undone = false
    const id = toast.add({
      title: "Draft deleted",
      description: draft.title,
      timeout: UNDO_MS,
      actionProps: {
        children: "Undo",
        onClick: () => {
          undone = true
          toast.close(id)
          unhide(draft.id)
          if (wasOpen)
            void router.navigate({
              to: "/d/$draftId",
              params: { draftId: draft.id },
            })
        },
      },
      onClose: () => {
        if (!undone) void commitDelete(draft)
      },
    })
  }

  async function commitDelete(draft: DraftRef) {
    try {
      await orpc.drafts.delete.call({ id: draft.id })
    } catch {
      unhide(draft.id)
      failed("We couldn’t delete the draft")
      return
    }
    queryClient.removeQueries({
      queryKey: orpc.drafts.get.key({ input: { id: draft.id } }),
    })
    queryClient.removeQueries({
      queryKey: orpc.chat.messages.key({ input: { id: draft.id } }),
    })
    await refreshLists()
  }

  return { rename, duplicate, remove }
}

function mapListed<T>(listed: Listed<T>, change: (each: T) => T): Listed<T> {
  if (Array.isArray(listed)) return listed.map(change)
  return { ...listed, pages: listed.pages.map((page) => page.map(change)) }
}
