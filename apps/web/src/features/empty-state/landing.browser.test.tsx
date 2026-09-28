import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { DISCLAIMER } from "@workspace/documents"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { describe, expect, test, vi } from "vite-plus/test"
import { userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { Landing, type Start } from "./landing"
import { starters } from "./starters"

// The start page (T37): a warm first run. One click on an example or an
// agreement starts a draft; the credit and the demo note are always there.

async function show({ isAccount = false } = {}) {
  const onStart = vi.fn<(from: Start) => void>()
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  })
  await router.load()
  const screen = await render(
    <RouterProvider
      router={router}
      defaultComponent={() => (
        <SidebarProvider defaultOpen={false}>
          <Landing isAccount={isAccount} busy={false} onStart={onStart} />
        </SidebarProvider>
      )}
    />
  )
  return { screen, onStart }
}

describe("the start page", () => {
  test("an example starts a draft with its whole prompt in one click", async () => {
    const { screen, onStart } = await show()
    const pilot = starters.find((starter) => starter.label.includes("pilot"))
    if (!pilot) throw new Error("no pilot example")

    await screen.getByRole("button", { name: pilot.label }).click()

    expect(onStart).toHaveBeenCalledWith({ text: pilot.prompt })
  })

  test("keeps the typed deal after sending, in case the start fails", async () => {
    // A failed start (Turnstile, a limit, the network) shows its note; the
    // deal must still be there to send again (Checkpoint 6 review). A start
    // that works leaves the page.
    const { screen, onStart } = await show()
    const box = screen.getByRole("textbox", { name: "Describe your deal" })

    await box.fill("An NDA with Acme for a roadmap review.")
    await userEvent.keyboard("{Enter}")

    expect(onStart).toHaveBeenCalledWith({
      text: "An NDA with Acme for a roadmap review.",
    })
    await expect
      .element(box)
      .toHaveValue("An NDA with Acme for a roadmap review.")
  })

  test("every example says more than its label", () => {
    for (const starter of starters) {
      expect(starter.prompt.length).toBeGreaterThan(starter.label.length)
      expect(starter.prompt).toMatch(/[.…]$/)
    }
  })

  test("lists the eleven agreements, each one click from a draft", async () => {
    const { screen, onStart } = await show()
    const library = screen.getByRole("list", { name: "The library" })

    await expect.element(library).toBeVisible()
    expect(library.getByRole("listitem").elements()).toHaveLength(11)
    await expect
      .element(
        library.getByText("Let a customer try your product before buying.")
      )
      .toBeVisible()

    await library.getByRole("button", { name: /Pilot Agreement/ }).click()

    expect(onStart).toHaveBeenCalledWith({ documentId: "pilot-agreement" })
  })

  test("a typed deal starts a draft on Enter", async () => {
    const { screen, onStart } = await show()

    await screen
      .getByRole("textbox", { name: "Describe your deal" })
      .fill("We’re lending our designer to a partner for a month.")
    await userEvent.keyboard("{Enter}")

    expect(onStart).toHaveBeenCalledWith({
      text: "We’re lending our designer to a partner for a month.",
    })
  })

  test("the closing call to action takes you to the reply box", async () => {
    const { screen } = await show()

    await screen.getByRole("button", { name: "Start drafting, free" }).click()

    await expect
      .element(screen.getByRole("textbox", { name: "Describe your deal" }))
      .toHaveFocus()
  })

  test("shows the Common Paper credit and the demo note", async () => {
    const { screen } = await show()

    await expect.element(screen.getByText(DISCLAIMER)).toBeVisible()
    await expect
      .element(screen.getByRole("link", { name: "Common Paper" }).first())
      .toHaveAttribute("href", "https://commonpaper.com/standards/")
    await expect
      .element(screen.getByRole("link", { name: "CC BY 4.0" }).first())
      .toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/")
  })

  test("a visitor is told no account is needed, and can sign in", async () => {
    const { screen } = await show()

    await expect
      .element(screen.getByText("Free to try · No account needed"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("link", { name: "Sign in" }).first())
      .toHaveAttribute("href", "/sign-in")
  })

  test("someone signed in isn't asked to sign in", async () => {
    const { screen } = await show({ isAccount: true })

    await expect
      .element(screen.getByRole("heading", { level: 1 }))
      .toBeVisible()
    expect(screen.getByRole("link", { name: "Sign in" }).elements()).toEqual([])
    expect(
      screen.getByText("Free to try · No account needed").elements()
    ).toEqual([])
  })
})
