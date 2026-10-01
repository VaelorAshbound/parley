import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router"
import type { DocumentId } from "@workspace/documents"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { ReopenCard } from "./reopen-card"

// A closed document panel leaves a card in the chat that opens it again
// (spec §1 Layout, PAR-44). Desktop only: a phone has the Document tab.

async function setUp({
  documentId = "mutual-nda",
  path = "/d/d1?panel=closed",
  onOpen,
}: {
  documentId?: DocumentId | null
  path?: string
  onOpen?: () => void
} = {}) {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  const screen = await render(
    <RouterProvider
      router={router}
      defaultComponent={() => <Draft documentId={documentId} onOpen={onOpen} />}
    />
  )
  return { screen, router }
}

// The draft page's rule: the URL says whether the panel is open.
function Draft({
  documentId,
  onOpen,
}: {
  documentId: DocumentId | null
  onOpen?: () => void
}) {
  const closed = useLocation({
    select: (location) => location.searchStr.includes("panel=closed"),
  })
  return (
    <ReopenCard panelOpen={!closed} documentId={documentId} onOpen={onOpen} />
  )
}

describe("the reopen card", () => {
  afterEach(async () => {
    await page.viewport(414, 896)
  })

  test("names the agreement and opens the panel", async () => {
    await page.viewport(1280, 800)
    // The chat moves focus with onOpen, since the card goes away.
    const onOpen = vi.fn<() => void>()
    const { screen, router } = await setUp({ onOpen })
    const card = screen.getByRole("group", { name: "Document closed" })
    await expect.element(card).toBeVisible()
    await expect
      .element(card.getByText("Mutual NDA", { exact: true }))
      .toBeVisible()
    const open = card.getByRole("link", { name: "Open document" })
    // A screen reader hears which document the button opens.
    await expect.element(open).toHaveAccessibleDescription("Mutual NDA")

    await open.click()

    expect(onOpen).toHaveBeenCalledOnce()
    expect(router.state.location.searchStr).not.toContain("panel=closed")
    await expect.element(card).not.toBeInTheDocument()
  })

  test("opens the panel from the keyboard", async () => {
    await page.viewport(1280, 800)
    const { screen, router } = await setUp()
    const open = screen.getByRole("link", { name: "Open document" })
    await expect.element(open).toBeVisible()

    await userEvent.tab()
    await expect.element(open).toHaveFocus()
    await userEvent.keyboard("{Enter}")

    await expect
      .poll(() => router.state.location.searchStr)
      .not.toContain("panel=closed")
  })

  test("doesn't show while the panel is open", async () => {
    await page.viewport(1280, 800)
    const { screen } = await setUp({ path: "/d/d1" })
    await expect
      .element(screen.getByRole("link", { name: "Open document" }))
      .not.toBeInTheDocument()
  })

  test("doesn't show before an agreement is picked", async () => {
    await page.viewport(1280, 800)
    const { screen } = await setUp({ documentId: null })
    await expect
      .element(screen.getByRole("link", { name: "Open document" }))
      .not.toBeInTheDocument()
  })

  test("doesn't show on a phone, which has the Document tab", async () => {
    await page.viewport(375, 812)
    const { screen } = await setUp()
    await expect
      .element(
        screen.getByRole("group", {
          name: "Document closed",
          includeHidden: true,
        })
      )
      .not.toBeVisible()
  })
})
