import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import type { ReactNode } from "react"
import { expect, test } from "vite-plus/test"
import { renderHook } from "vitest-browser-react"

import { UiStoreProvider } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"
import type { Router } from "@/server/rpc/router"

import { useDocumentSync } from "./use-document-sync"

// PAR-32: the AI picks an agreement (the page loads the draft again), then
// fills a field. The load reads the database before the field is saved, and
// its answer arrives after the field is in the document. It must not put the
// template's value back.

const draftId = "0199c0de-0000-7000-8000-000000000032"
const template = "Evaluating whether to enter into a business relationship."
const roadmap = "Sharing our product roadmap with a vendor."

/** A server whose draft reads wait until the test lets them answer. */
function heldServer() {
  const saved = {
    documentId: null as string | null,
    fields: {} as Record<string, unknown>,
  }
  const held: (() => void)[] = []
  const client = {
    drafts: {
      // The read takes its copy now, and answers when released.
      get: () => {
        const copy = structuredClone({ id: draftId, ...saved })
        return new Promise((resolve) => held.push(() => resolve(copy)))
      },
      list: async () => [],
    },
  } as unknown as RouterClient<Router>
  const release = () => held.splice(0).forEach((answer) => answer())
  return { orpc: createTanstackQueryUtils(client), saved, release }
}

const chose: ChatMessage["parts"][number] = {
  type: "tool-chooseDocument",
  toolCallId: "call-choose",
  state: "output-available",
  input: { documentId: "mutual-nda", reason: "Plans." },
  output: { documentId: "mutual-nda", title: "Mutual NDA" },
}

const filled: ChatMessage["parts"][number] = {
  type: "tool-updateFields",
  toolCallId: "call-purpose",
  state: "output-available",
  input: {
    changes: [{ key: "purpose", value: roadmap, explanation: "Use." }],
  },
  output: {
    applied: [
      { key: "purpose", before: template, after: roadmap, explanation: "Use." },
    ],
    rejected: [],
    inverse: [{ key: "purpose", value: template, expected: roadmap }],
  },
}

const reply = (parts: ChatMessage["parts"]): ChatMessage[] => [
  { id: "reply", role: "assistant", parts },
]

const law = "The laws of the State of New York."

const alsoFilled: ChatMessage["parts"][number] = {
  type: "tool-updateFields",
  toolCallId: "call-law",
  state: "output-available",
  input: {
    changes: [{ key: "governingLaw", value: law, explanation: "Where." }],
  },
  output: {
    applied: [
      {
        key: "governingLaw",
        before: undefined,
        after: law,
        explanation: "Where.",
      },
    ],
    rejected: [],
    inverse: [{ key: "governingLaw", value: undefined, expected: law }],
  },
}

/** The page: the document panel shows the draft, and the chat syncs it. */
async function renderPage() {
  const server = heldServer()
  const queryClient = new QueryClient()
  const key = server.orpc.drafts.get.queryKey({ input: { id: draftId } })
  queryClient.setQueryData(key, {
    id: draftId,
    documentId: null,
    fields: {},
  } as never)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UiStoreProvider>{children}</UiStoreProvider>
    </QueryClientProvider>
  )
  const { rerender } = await renderHook(
    (props?: { messages: ChatMessage[] }) => {
      // The document panel shows the draft, so an invalidation refetches it.
      useQuery({
        ...server.orpc.drafts.get.queryOptions({ input: { id: draftId } }),
        staleTime: Infinity,
      })
      useDocumentSync(server.orpc, draftId, props?.messages ?? [])
    },
    { wrapper, initialProps: { messages: [] as ChatMessage[] } }
  )
  const shown = (field: string) =>
    (queryClient.getQueryData(key) as { fields: Record<string, unknown> })
      .fields[field]
  const loading = () => queryClient.isFetching({ queryKey: key })
  /** Lets every held read answer, until none is left. */
  const answerAll = () =>
    expect
      .poll(() => {
        server.release()
        return loading()
      })
      .toBe(0)
  return { server, rerender, shown, loading, answerAll }
}

test("a draft load that started before a field was saved does not undo the field", async () => {
  const { server, rerender, shown, loading, answerAll } = await renderPage()

  // The server saves the chosen agreement; the page starts loading the draft.
  server.saved.documentId = "mutual-nda"
  server.saved.fields = { purpose: template }
  await rerender({ messages: reply([chose]) })
  expect(loading()).toBe(1)

  // The server saves the field; its result reaches the page.
  server.saved.fields = { purpose: roadmap }
  await rerender({ messages: reply([chose, filled]) })
  expect(shown("purpose")).toBe(roadmap)

  // Now the early load answers, with the template's value.
  await answerAll()
  expect(shown("purpose")).toBe(roadmap)
})

test("a second field saved while the page is loading again keeps both fields", async () => {
  const { server, rerender, shown, loading, answerAll } = await renderPage()

  server.saved.documentId = "mutual-nda"
  server.saved.fields = { purpose: template }
  await rerender({ messages: reply([chose]) })

  // The first field starts a fresh load, which is still on its way ...
  server.saved.fields = { purpose: roadmap }
  await rerender({ messages: reply([chose, filled]) })
  expect(loading()).toBe(1)

  // ... when the second field is saved and its result arrives.
  server.saved.fields = { purpose: roadmap, governingLaw: law }
  await rerender({ messages: reply([chose, filled, alsoFilled]) })

  await answerAll()
  expect(shown("purpose")).toBe(roadmap)
  expect(shown("governingLaw")).toBe(law)
})

test("a field change with no load on its way does not load the draft again", async () => {
  const { server, rerender, shown, loading } = await renderPage()

  server.saved.fields = { purpose: roadmap }
  await rerender({ messages: reply([filled]) })

  expect(shown("purpose")).toBe(roadmap)
  expect(loading()).toBe(0)
})
