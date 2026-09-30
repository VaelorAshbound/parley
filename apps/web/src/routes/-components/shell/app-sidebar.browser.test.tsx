import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { SidebarProvider, useSidebar } from "@workspace/ui/components/sidebar"
import { describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { ThemeProvider } from "@/components/theme-provider"
import type { Orpc } from "@/lib/orpc"

import { AppSidebar } from "./app-sidebar"

// The account row reads the session through a server function, which a
// browser test can't load; it isn't what these tests are about. (Its guest
// "Sign in" link goes to /sign-in, outside the app shell, so the drawer
// goes away with the shell there.)
vi.mock("./account-menu", () => ({ AccountMenu: () => null }))

// The left sidebar (T21). On a phone it is a drawer: a link in it that opens
// a page must close it, or the page stays under the drawer (PAR-12, PAR-29).

async function setUp() {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/d/d1"] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider
        router={router}
        defaultComponent={() => (
          // Inside the router: its theme script is a router ScriptOnce.
          <ThemeProvider>
            <SidebarProvider>
              <DrawerProbe />
              <AppSidebar viewer={null} orpc={{} as Orpc} calendarKey="" />
            </SidebarProvider>
          </ThemeProvider>
        )}
      />
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

  test("the Parley logo closes the phone drawer", async () => {
    const screen = await setUp()
    await screen.getByRole("button", { name: "Open drawer" }).click()
    const drawer = screen.getByRole("dialog")
    await expect.element(drawer).toBeVisible()

    await drawer.getByRole("link", { name: "Parley home" }).first().click()

    await expect.element(drawer).not.toBeInTheDocument()
  })
})
