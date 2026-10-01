import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { applyFieldChanges, definitions } from "@workspace/documents"
import type { ReactNode } from "react"
import { describe, expect, test } from "vite-plus/test"
import { renderHook } from "vitest-browser-react"

import type { Router } from "@/server/rpc/router"
import { UiStoreProvider } from "@/lib/ui-store"

import { useSaveField } from "./use-save-field"

// Saving on a slow network (T16): every edit shows at once, even while
// earlier saves are still on their way, and the server's copy wins at the end.

const nda = definitions["mutual-nda"]
const draftId = "0199c0de-0000-7000-8000-000000000001"

function slowServer(delay: number) {
  let fields: Record<string, unknown> = {}
  const draft = () => ({ id: draftId, documentId: "mutual-nda", fields })
  const client = {
    drafts: {
      get: async () => draft(),
      list: async () => [],
      updateFields: async ({
        changes,
      }: {
        changes: { key: string; value: unknown }[]
      }) => {
        await new Promise((resolve) => setTimeout(resolve, delay))
        const result = applyFieldChanges(nda, fields, changes)
        fields = result.values
        return { ...result, draft: draft() }
      },
    },
  } as unknown as RouterClient<Router>
  return { orpc: createTanstackQueryUtils(client), fields: () => fields }
}

async function setUp(delay: number) {
  const server = slowServer(delay)
  const queryClient = new QueryClient()
  const key = server.orpc.drafts.get.queryKey({ input: { id: draftId } })
  queryClient.setQueryData(key, {
    id: draftId,
    documentId: "mutual-nda",
    fields: {},
  } as never)
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  })
  await router.load()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UiStoreProvider>
        <RouterProvider router={router} defaultComponent={() => children} />
      </UiStoreProvider>
    </QueryClientProvider>
  )
  const { result } = await renderHook(
    () => useSaveField(server.orpc, draftId),
    { wrapper }
  )
  const shown = () => queryClient.getQueryData(key)?.fields ?? {}
  return { save: result.current, shown, server, queryClient }
}

describe("saving a field", () => {
  test("shows every edit at once, even while earlier saves are slow", async () => {
    const { save, shown } = await setUp(300)

    save({ fieldKey: "purpose", change: "Hiring.", inputs: {} })
    save({ fieldKey: "modifications", change: "None.", inputs: {} })
    save({
      fieldKey: "party1",
      change: { company: "Acme" },
      inputs: {},
    })

    expect(shown()).toEqual({
      purpose: "Hiring.",
      modifications: "None.",
      party1: { company: "Acme" },
    })
  })

  test("ends with the server's copy once every save is done", async () => {
    const { save, shown, server, queryClient } = await setUp(50)

    save({ fieldKey: "purpose", change: "Hiring.", inputs: {} })
    save({ fieldKey: "purpose", change: "Buying.", inputs: {} })

    await expect.poll(() => queryClient.isMutating()).toBe(0)
    expect(server.fields()).toEqual({ purpose: "Buying." })
    expect(shown()).toEqual({ purpose: "Buying." })
  })
})
