import { ORPCError } from "@orpc/client"
import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@workspace/ui/components/toast"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import type { Router } from "@/server/rpc/router"

import { ShareMenu } from "./share-menu"

// The Share menu in the document panel (T25). The server is a fake: each
// test says what share.get, share.create and share.revoke answer. The
// clipboard is watched, not written, so the tests don't need its permission.

const draftId = "0199c0de-0000-7000-8000-000000000025"
const token = "q7Yx0mJ3kQeZ5bHn2sT9vA"
const link = { token, createdAt: new Date("2026-09-25T10:00:00Z") }

type Link = typeof link

function fakeServer({
  get = async () => null,
  create = async () => link,
  revoke = async () => undefined,
}: {
  get?: () => Promise<Link | null>
  create?: () => Promise<Link>
  revoke?: (input: { id: string }) => Promise<void>
}) {
  const client = { share: { get, create, revoke } }
  return createTanstackQueryUtils(client as unknown as RouterClient<Router>)
}

/** What the page put on the clipboard, as text. */
function clipboard() {
  const copied: string[] = []
  vi.spyOn(navigator.clipboard, "write").mockImplementation(async (items) => {
    for (const item of items)
      copied.push(await (await item.getType("text/plain")).text())
  })
  return copied
}

async function show(orpc: ReturnType<typeof fakeServer>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Toaster>
        <ShareMenu orpc={orpc} draftId={draftId} />
      </Toaster>
    </QueryClientProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("the Share menu", () => {
  test("copies the link and says so", async () => {
    const copied = clipboard()
    const screen = await show(fakeServer({}))

    await screen.getByRole("button", { name: "Share" }).click()
    await screen.getByRole("menuitem", { name: "Copy link" }).click()

    await expect.element(screen.getByText("Link copied")).toBeVisible()
    expect(copied).toEqual([`${location.origin}/s/${token}`])
  })

  test("offers to stop sharing only while a link is on", async () => {
    const screen = await show(fakeServer({ get: async () => null }))

    await screen.getByRole("button", { name: "Share" }).click()

    await expect
      .element(screen.getByRole("menuitem", { name: "Copy link" }))
      .toBeVisible()
    expect(
      screen.getByRole("menuitem", { name: "Stop sharing" }).query()
    ).toBeNull()
  })

  test("turns the link off and says so", async () => {
    // A server whose link is on until it is turned off.
    let on = true
    const revoke = vi.fn<(input: { id: string }) => Promise<void>>(async () => {
      on = false
    })
    const screen = await show(
      fakeServer({ get: async () => (on ? link : null), revoke })
    )

    await screen.getByRole("button", { name: "Share" }).click()
    await screen.getByRole("menuitem", { name: "Stop sharing" }).click()

    await expect.element(screen.getByText("Link turned off")).toBeVisible()
    expect(revoke).toHaveBeenCalledWith({ id: draftId })
    await screen.getByRole("button", { name: "Share" }).click()
    await expect
      .element(screen.getByRole("menuitem", { name: "Copy link" }))
      .toBeVisible()
    expect(
      screen.getByRole("menuitem", { name: "Stop sharing" }).query()
    ).toBeNull()
  })

  test("asks a guest to make an account first", async () => {
    clipboard()
    const screen = await show(
      fakeServer({
        create: () =>
          Promise.reject(new ORPCError("UNAUTHORIZED", { defined: true })),
      })
    )

    await screen.getByRole("button", { name: "Share" }).click()
    await screen.getByRole("menuitem", { name: "Copy link" }).click()

    await expect
      .element(screen.getByText("Create a free account to share"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Create an account" }))
      .toBeVisible()
  })

  test("asks for a confirmed email first", async () => {
    clipboard()
    const screen = await show(
      fakeServer({
        create: () =>
          Promise.reject(
            new ORPCError("EMAIL_NOT_VERIFIED", { defined: true })
          ),
      })
    )

    await screen.getByRole("button", { name: "Share" }).click()
    await screen.getByRole("menuitem", { name: "Copy link" }).click()

    await expect
      .element(screen.getByText("Confirm your email to share"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Get a new link" }))
      .toBeVisible()
  })

  test("says so when the browser won't copy", async () => {
    vi.spyOn(navigator.clipboard, "write").mockRejectedValue(
      new DOMException("Denied", "NotAllowedError")
    )
    const screen = await show(fakeServer({}))

    await screen.getByRole("button", { name: "Share" }).click()
    await screen.getByRole("menuitem", { name: "Copy link" }).click()

    await expect
      .element(screen.getByText("Your link is ready, but not copied"))
      .toBeVisible()
  })
})
