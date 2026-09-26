import type { ChangeIssue } from "@workspace/documents"
import { createContext, useContext, useState } from "react"
import { createStore, useStore, type StoreApi } from "zustand"

// Client-only UI state (spec §5 Zustand rules). One store per app instance,
// made in a provider, never at module scope: on Workers one isolate renders
// many users' pages, and a module-level store would leak between them.
// Server data lives in TanStack Query; shareable state lives in the URL.

/**
 * A save the server refused, kept so the editor can open again with what
 * was typed and why it was refused (T16).
 */
export type Refused = {
  draftId: string
  fieldKey: string
  inputs: Record<string, string>
  issues: ChangeIssue[]
}

type UiState = {
  /**
   * Fields the AI changed since the user's last message, each with a count
   * that grows with every change, so the same field can ink in again
   * (brand.md → "Just changed").
   */
  changed: Record<string, number>
  /** The field the document panel scrolls to: the latest change's first. */
  focus: { field: string; seq: number } | null
  /** A change the phone's Document tab hasn't shown yet (its badge). */
  unseen: boolean
  markChanged: (fields: string[]) => void
  /** The next message settles the highlights. */
  settle: () => void
  seeDocument: () => void
  /** AI changes undone from the chat, by "toolCallId:field". */
  undo: Record<string, "undone" | "stale">
  setUndo: (row: string, state: "undone" | "stale") => void
  refused: Refused | null
  setRefused: (refused: Refused | null) => void
  /** A first message typed on the home page, sent once its draft opens. */
  pending: { draftId: string; text: string } | null
  setPending: (pending: { draftId: string; text: string } | null) => void
  /**
   * Drafts deleted in this tab: hidden while their undo toast is open, and
   * after, so a list fetched before the delete can't show them again (T22).
   */
  hidden: Record<string, true>
  hide: (draftId: string) => void
  unhide: (draftId: string) => void
}

export function createUiStore() {
  return createStore<UiState>()((set) => ({
    changed: {},
    focus: null,
    unseen: false,
    markChanged: (fields) =>
      set((state) => {
        if (fields.length === 0) return state
        let seq = Math.max(
          0,
          ...Object.values(state.changed),
          state.focus?.seq ?? 0
        )
        const changed = { ...state.changed }
        for (const field of fields) changed[field] = ++seq
        const [first = ""] = fields
        return {
          changed,
          focus: { field: first, seq: changed[first] ?? seq },
          unseen: true,
        }
      }),
    settle: () => set({ changed: {} }),
    seeDocument: () => set({ unseen: false }),
    undo: {},
    setUndo: (row, state) =>
      set((current) => ({ undo: { ...current.undo, [row]: state } })),
    refused: null,
    setRefused: (refused) => set({ refused }),
    pending: null,
    setPending: (pending) => set({ pending }),
    hidden: {},
    hide: (draftId) =>
      set((state) => ({ hidden: { ...state.hidden, [draftId]: true } })),
    unhide: (draftId) =>
      set((state) => {
        const { [draftId]: _, ...hidden } = state.hidden
        return { hidden }
      }),
  }))
}

const UiStoreContext = createContext<StoreApi<UiState> | null>(null)

export function UiStoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createUiStore)
  return (
    <UiStoreContext.Provider value={store}>{children}</UiStoreContext.Provider>
  )
}

export function useUiStore<T>(selector: (state: UiState) => T) {
  const store = useContext(UiStoreContext)
  if (!store) throw new Error("useUiStore needs a UiStoreProvider")
  return useStore(store, selector)
}
