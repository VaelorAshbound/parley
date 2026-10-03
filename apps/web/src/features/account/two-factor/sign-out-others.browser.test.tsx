import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { SignOutOthers } from "./sign-out-others"

// "Sign out other devices" on the backup codes step (PAR-20). A signed-out
// device keeps its 5-minute session cookie cache (server/auth.ts), so the
// page must not say it is already done.

const revokeOtherSessions = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: unknown; error: unknown }>>()
)
vi.mock("@/lib/auth-client", () => ({ authClient: { revokeOtherSessions } }))

afterEach(() => revokeOtherSessions.mockReset())

describe("SignOutOthers", () => {
  test("says the other devices go within 5 minutes, not at once", async () => {
    revokeOtherSessions.mockResolvedValue({
      data: { status: true },
      error: null,
    })
    const screen = await render(<SignOutOthers />)

    await screen.getByRole("button", { name: "Sign out other devices" }).click()

    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Other devices will be signed out within 5 minutes.")
  })

  test("keeps keyboard focus on the result when the button goes", async () => {
    revokeOtherSessions.mockResolvedValue({
      data: { status: true },
      error: null,
    })
    const screen = await render(<SignOutOthers />)

    await screen.getByRole("button", { name: "Sign out other devices" }).click()

    await expect.element(screen.getByRole("status")).toHaveFocus()
  })
})
