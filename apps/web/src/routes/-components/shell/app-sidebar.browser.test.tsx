import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { SidebarProvider, useSidebar } from "@workspace/ui/components/sidebar"
import { Temporal } from "temporal-polyfill"
import { describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { ThemeProvider } from "@/components/theme-provider"
import { calendarKey } from "@/features/drafts/calendar"
import type { Viewer } from "@/lib/session"
import { UiStoreProvider } from "@/lib/ui-store"
import type { Router } from "@/server/rpc/router"

import { AppSidebar } from "./app-sidebar"

// The session module is server code (a server function), which a browser
// test can't load. The account menu reaches it only through billing, for
// the Polar portal, which these tests don't open.
vi.mock("@/lib/session", () => ({
  viewerQuery: { queryKey: ["viewer"] },
  freshViewer: vi.fn<() => Promise<Viewer>>(),
}))

const account: Viewer = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  isAnonymous: false,
  plan: "free",
}

// The left sidebar (T21). On a phone it is a drawer: a link in it that opens
// a page must close it, or the page stays under the drawer (PAR-12, PAR-29).

// The history shows one draft; nothing else of the API is used.
const orpc = createTanstackQueryUtils({
  drafts: {
    list: async () => [
      {
        id: "d2",
        title: "Acme NDA",
        updatedAt: new Date(),
        documentId: null,
        status: "drafting",
      },
    ],
  },
} as unknown as RouterClient<Router>)

async function setUp(viewer: Viewer = null, path = "/d/d1") {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UiStoreProvider>
        <RouterProvider
          router={router}
          defaultComponent={() => (
            // Inside the router: its theme script is a router ScriptOnce.
            <ThemeProvider>
              <SidebarProvider>
                <DrawerProbe />
                <AppSidebar
                  viewer={viewer}
                  orpc={orpc}
                  calendarKey={calendarKey({
                    timeZone: "UTC",
                    today: Temporal.Now.plainDateISO("UTC"),
                  })}
                />
              </SidebarProvider>
            </ThemeProvider>
          )}
        />
      </UiStoreProvider>
    </QueryClientProvider>
  )
}

// Opens the phone drawer as the menu button in the page header would. (The
// tests run at phone width, so the sidebar is the drawer, a modal dialog.)
function DrawerProbe() {
  const { setOpenMobile } = useSidebar()
  return (
    <button type="button" onClick={() => setOpenMobile(true)}>
      Open drawer
    </button>
  )
}

describe("the app sidebar", () => {
  test("New draft closes the phone drawer", async () => {
    const screen = await setUp()
    await screen.getByRole("button", { name: "Open drawer" }).click()
    const drawer = screen.getByRole("dialog")
    await expect.element(drawer).toBeVisible()

    await drawer.getByRole("link", { name: "New draft" }).click()

    await expect.element(drawer).not.toBeInTheDocument()
  })

  // The page doesn't change, but the person asked for it: show it.
  test("New draft on the new-draft page closes the phone drawer", async () => {
    const screen = await setUp(null, "/")
    await screen.getByRole("button", { name: "Open drawer" }).click()
    const drawer = screen.getByRole("dialog")
    await expect.element(drawer).toBeVisible()

    await drawer.getByRole("link", { name: "New draft" }).click()

    await expect.element(drawer).not.toBeInTheDocument()
  })

  test("the Parley logo closes the phone drawer", async () => {
    const screen = await setUp()
    await screen.getByRole("button", { name: "Open drawer" }).click()
    const drawer = screen.getByRole("dialog")
    await expect.element(drawer).toBeVisible()

    await drawer.getByRole("link", { name: "Parley home" }).first().click()

    await expect.element(drawer).not.toBeInTheDocument()
  })

  test("a draft in the history closes the phone drawer", async () => {
    const screen = await setUp(account)
    await screen.getByRole("button", { name: "Open drawer" }).click()
    const drawer = screen.getByRole("dialog")
    await expect.element(drawer).toBeVisible()

    await drawer.getByRole("link", { name: "Acme NDA" }).click()

    await expect.element(drawer).not.toBeInTheDocument()
  })

  // The account menu opens in a portal, outside the drawer's page tree, and
  // both its links go to pages in the app shell, where the drawer lives on.
  for (const item of ["Settings", "Upgrade to Pro"])
    test(`the account menu's ${item} closes the phone drawer`, async () => {
      const screen = await setUp(account)
      await screen.getByRole("button", { name: "Open drawer" }).click()
      const drawer = screen.getByRole("dialog")
      await expect.element(drawer).toBeVisible()

      await drawer.getByRole("button", { name: /Ada Lovelace/ }).click()
      await screen.getByRole("menuitem", { name: item }).click()

      await expect.element(drawer).not.toBeInTheDocument()
    })
})
