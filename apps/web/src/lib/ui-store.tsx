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
  /** The document field the chat or the editor points at. */
  highlightedField: string | null
  highlightField: (field: string | null) => void
  refused: Refused | null
  setRefused: (refused: Refused | null) => void
  /** A first message typed on the home page, sent once its draft opens. */
  pending: { draftId: string; text: string } | null
  setPending: (pending: { draftId: string; text: string } | null) => void
}

export function createUiStore() {
  return createStore<UiState>()((set) => ({
    highlightedField: null,
    highlightField: (field) => set({ highlightedField: field }),
    refused: null,
    setRefused: (refused) => set({ refused }),
    pending: null,
    setPending: (pending) => set({ pending }),
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
