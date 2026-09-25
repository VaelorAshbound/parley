import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { Temporal } from "temporal-polyfill"
import { describe, expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { UiStoreProvider } from "@/lib/ui-store"
import type { Router } from "@/server/rpc/router"

import { calendarKey } from "./calendar"
import { SearchDialog } from "./search-dialog"

// Sidebar search (⌘K, T22): the server searches as you type, one request
// per pause, and Enter opens the draft.

const today = Temporal.Now.zonedDateTimeISO("UTC")
const recent = [
  { id: "d1", title: "Acme NDA", documentId: "mutual-nda" as const },
  { id: "d2", title: "Bolt pilot", documentId: "pilot-agreement" as const },
].map((draft) => ({
  ...draft,
  status: "drafting" as const,
  updatedAt: new Date(today.epochMilliseconds),
}))

type ListInput = { query?: string; limit?: number }

async function setUp() {
  const list = vi.fn<(input: ListInput) => Promise<typeof recent>>(
    async (input) =>
      input.query
        ? recent.filter((draft) =>
            draft.title.toLowerCase().includes(input.query!.toLowerCase())
          )
        : recent
  )
  const orpc = createTanstackQueryUtils({
    drafts: { list },
  } as unknown as RouterClient<Router>)
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <SearchDialog
          open
          onOpenChange={() => {}}
          orpc={orpc}
          showAll={false}
          calendarKey={calendarKey({
            timeZone: "UTC",
            today: today.toPlainDate(),
          })}
        />
        <Outlet />
      </>
    ),
  })
  const draftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/d/$draftId",
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([draftRoute]),
    history: createMemoryHistory(),
  })
  await router.load()
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <UiStoreProvider>
        <RouterProvider router={router} />
      </UiStoreProvider>
    </QueryClientProvider>
  )
  return { list, router }
}

describe("draft search", () => {
  test("shows the recent drafts before anything is typed", async () => {
    await setUp()

    await expect
      .element(page.getByRole("option", { name: /Acme NDA/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole("option", { name: /Bolt pilot/ }))
      .toMatchTextContent(/Pilot Agreement/)
  })

  test("asks the server once per pause, not once per key", async () => {
    const { list } = await setUp()
    await expect
      .element(page.getByRole("option", { name: /Acme NDA/ }))
      .toBeVisible()

    await userEvent.type(page.getByRole("combobox"), "bol")

    await expect
      .element(page.getByRole("option", { name: /Bolt pilot/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole("option", { name: /Acme NDA/ }))
      .not.toBeInTheDocument()
    const searches = list.mock.calls
      .map(([input]) => input.query)
      .filter(Boolean)
    // Usually just "bol"; on a busy machine a key can come after the pause.
    expect(searches.at(-1)).toBe("bol")
    expect(searches.length).toBeLessThan(3)
  })

  test("arrow keys move the highlight, and Enter opens that draft", async () => {
    const { router } = await setUp()
    await expect
      .element(page.getByRole("option", { name: /Acme NDA/ }))
      .toHaveAttribute("aria-selected", "true")

    await userEvent.keyboard("{ArrowDown}{Enter}")

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/d/d2"))
  })

  test("says so when nothing matches", async () => {
    await setUp()

    await userEvent.type(page.getByRole("combobox"), "zzz")

    await expect.element(page.getByText("No drafts match “zzz”.")).toBeVisible()
  })

  test("Enter opens the top result for what was typed, even before it shows", async () => {
    const { router } = await setUp()
    await expect
      .element(page.getByRole("option", { name: /Acme NDA/ }))
      .toBeVisible()

    // Straight after typing, the list still shows the recent drafts.
    await userEvent.type(page.getByRole("combobox"), "bol{Enter}")

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/d/d2"))
  })
})
