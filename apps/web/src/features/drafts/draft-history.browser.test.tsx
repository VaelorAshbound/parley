import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { Toaster } from "@workspace/ui/components/toast"
import { Temporal } from "temporal-polyfill"
import { describe, expect, test, vi } from "vite-plus/test"
import { page } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import type { Router } from "@/server/rpc/router"
import { UiStoreProvider } from "@/lib/ui-store"

import { calendarKey } from "./calendar"
import { DraftHistory } from "./draft-history"

// The sidebar's history (T22): drafts under their day, each with a menu, and
// a delete that waits for its undo toast before it reaches the server.

const now = Temporal.Now.zonedDateTimeISO("UTC")
const hoursAgo = (hours: number) =>
  new Date(now.subtract({ hours }).epochMilliseconds)
const drafts = [
  { id: "d1", title: "Acme NDA", updatedAt: hoursAgo(0), documentId: null },
  { id: "d2", title: "Bolt pilot", updatedAt: hoursAgo(24), documentId: null },
  {
    id: "d3",
    title: "Old SLA",
    updatedAt: hoursAgo(24 * 30),
    documentId: null,
  },
].map((draft) => ({ ...draft, status: "drafting" as const }))

async function setUp({ isAccount = true } = {}) {
  const removed = vi.fn<(input: { id: string }) => Promise<void>>(
    async () => {}
  )
  const client = {
    drafts: {
      list: async () => drafts,
      get: async () => undefined,
      delete: removed,
    },
    chat: { messages: async () => [] },
  } as unknown as RouterClient<Router>
  const orpc = createTanstackQueryUtils(client)
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  })
  await router.load()
  const screen = await render(
    <QueryClientProvider client={new QueryClient()}>
      <UiStoreProvider>
        <Toaster>
          <RouterProvider
            router={router}
            defaultComponent={() => (
              <SidebarProvider>
                <DraftHistory
                  orpc={orpc}
                  isAccount={isAccount}
                  calendarKey={calendarKey({
                    timeZone: "UTC",
                    today: now.toPlainDate(),
                  })}
                />
              </SidebarProvider>
            )}
          />
        </Toaster>
      </UiStoreProvider>
    </QueryClientProvider>
  )
  return { screen, removed }
}

describe("the draft history", () => {
  test("puts each draft under its day", async () => {
    const { screen } = await setUp()

    await expect
      .element(screen.getByRole("list", { name: "Today" }))
      .toHaveTextContent("Acme NDA")
    await expect
      .element(screen.getByRole("list", { name: "Yesterday" }))
      .toHaveTextContent("Bolt pilot")
    await expect
      .element(screen.getByRole("list", { name: "Older" }))
      .toHaveTextContent("Old SLA")
    await expect
      .element(screen.getByRole("link", { name: "View all" }))
      .toHaveAttribute("href", "/drafts")
  })

  test("offers rename, duplicate and delete for each draft", async () => {
    const { screen } = await setUp()

    await screen.getByRole("button", { name: "More for Bolt pilot" }).click()

    await expect
      .element(page.getByRole("menuitem", { name: "Rename" }))
      .toBeVisible()
    await expect
      .element(page.getByRole("menuitem", { name: "Duplicate" }))
      .toBeVisible()
    await expect
      .element(page.getByRole("menuitem", { name: "Delete" }))
      .toBeVisible()
  })

  test("a guest has one draft: no duplicate, no View all", async () => {
    const { screen } = await setUp({ isAccount: false })

    await screen.getByRole("button", { name: "More for Bolt pilot" }).click()

    await expect
      .element(page.getByRole("menuitem", { name: "Rename" }))
      .toBeVisible()
    await expect
      .element(page.getByRole("menuitem", { name: "Duplicate" }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByRole("link", { name: "View all" }))
      .not.toBeInTheDocument()
  })

  test("a delete hides the draft at once, and Undo brings it back untouched", async () => {
    const { screen, removed } = await setUp()

    await screen.getByRole("button", { name: "More for Bolt pilot" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    await expect
      .element(screen.getByRole("link", { name: "Bolt pilot" }))
      .not.toBeInTheDocument()
    await expect.element(page.getByText("Draft deleted")).toBeVisible()
    await page.getByRole("button", { name: "Undo" }).click()

    await expect
      .element(screen.getByRole("link", { name: "Bolt pilot" }))
      .toBeVisible()
    expect(removed).not.toHaveBeenCalled()
  })

  test("the delete reaches the server when its toast closes", async () => {
    const { screen, removed } = await setUp()

    await screen.getByRole("button", { name: "More for Old SLA" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    // Base UI marks the toast's close button aria-hidden; a mouse still
    // clicks it.
    await page
      .getByRole("button", { name: "Close toast", includeHidden: true })
      .click()

    await vi.waitFor(() => expect(removed).toHaveBeenCalledOnce())
    expect(removed.mock.calls[0]?.[0]).toEqual({ id: "d3" })
    await expect
      .element(screen.getByRole("link", { name: "Old SLA" }))
      .not.toBeInTheDocument()
  })
})
