import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { focusManager, QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, expect, test, vi } from "vite-plus/test"

import type { Router } from "@/server/rpc/router"

import type { Shared } from "./share-page"
import { sharedDraftQuery } from "./shared-query"

// A visitor's page reads the shared draft once per load: coming back to the
// tab must not call share.view again (one more Worker request, DB read and
// share_viewed log each time, and a refetch can't show a revoke anyway).

afterEach(() => focusManager.setFocused(undefined))

test("reads the shared draft once per page load, not again on focus", async () => {
  const view = vi.fn<() => Promise<Shared>>(async () => ({
    title: "NDA with Bolt",
    documentId: "mutual-nda",
    values: {},
  }))
  const orpc = createTanstackQueryUtils({
    share: { view },
  } as unknown as RouterClient<Router>)
  const queryClient = new QueryClient()
  const options = sharedDraftQuery(orpc, "q7Yx0mJ3kQeZ5bHn2sT9vA")
  await queryClient.fetchQuery(options)
  const observer = new QueryObserver(queryClient, options)
  const stop = observer.subscribe(() => {})

  focusManager.setFocused(false)
  focusManager.setFocused(true)
  // A refetch would start on focus; give it time to reach the server.
  await new Promise((resolve) => setTimeout(resolve, 20))

  expect(view).toHaveBeenCalledTimes(1)
  stop()
})
