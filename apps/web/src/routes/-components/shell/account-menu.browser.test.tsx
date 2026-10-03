import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import type { Viewer } from "@/lib/session"

import { AccountMenu } from "./account-menu"

// The session module is server code (a server function), which a browser
// test can't load; the menu reaches it only through billing.
vi.mock("@/lib/session", () => ({
  viewerQuery: { queryKey: ["viewer"] },
  freshViewer: vi.fn<() => Promise<Viewer>>(),
}))

const free = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  isAnonymous: false,
  plan: "free",
  hasBilling: false,
} satisfies Viewer

async function openMenu(viewer: Viewer) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  await router.load()
  const screen = await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider
        router={router}
        defaultComponent={() => (
          <SidebarProvider>
            <AccountMenu viewer={viewer} />
          </SidebarProvider>
        )}
      />
    </QueryClientProvider>
  )
  await screen.getByRole("button", { name: /Ada Lovelace/ }).click()
  return screen
}

// The account menu's way to billing (T26, PAR-21): Polar's portal holds
// the card, the invoices and canceling.
describe("the account menu", () => {
  test("offers a Free user who paid before both Upgrade and Billing", async () => {
    // Pro ended, but the past invoices are still in Polar's portal.
    const screen = await openMenu({ ...free, hasBilling: true })

    await expect
      .element(screen.getByRole("menuitem", { name: "Upgrade to Pro" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("menuitem", { name: "Billing" }))
      .toBeVisible()
  })

  test("offers a Free user who never paid only Upgrade", async () => {
    const screen = await openMenu(free)

    await expect
      .element(screen.getByRole("menuitem", { name: "Upgrade to Pro" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("menuitem", { name: "Billing" }))
      .not.toBeInTheDocument()
  })

  test("offers a Pro user Billing instead of Upgrade", async () => {
    const screen = await openMenu({ ...free, plan: "pro", hasBilling: true })

    await expect
      .element(screen.getByRole("menuitem", { name: "Billing" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("menuitem", { name: "Upgrade to Pro" }))
      .not.toBeInTheDocument()
  })
})
