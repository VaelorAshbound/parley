import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { BackupCodes } from "./backup-codes"

// The backup codes' Copy and Download (T23b, PAR-20). A browser may refuse
// the clipboard (no permission, or the page lost focus); Safari may cancel
// a download whose blob URL is revoked too soon.

const codes = ["aaaaa-bbbbb", "ccccc-ddddd"]

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("BackupCodes", () => {
  test("says Copied once the clipboard has the codes", async () => {
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined)
    const screen = await render(<BackupCodes codes={codes} />)

    await screen.getByRole("button", { name: "Copy" }).click()

    await expect
      .element(screen.getByRole("button", { name: "Copied" }))
      .toBeVisible()
    expect(write).toHaveBeenCalledWith("aaaaa-bbbbb\nccccc-ddddd\n")
  })

  test("points to Download when the browser refuses the clipboard", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Write permission denied.", "NotAllowedError")
    )
    const screen = await render(<BackupCodes codes={codes} />)

    await screen.getByRole("button", { name: "Copy" }).click()

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Couldn’t copy. Use Download.")
    await expect
      .element(screen.getByRole("button", { name: "Copy" }))
      .toBeVisible()
  })

  test("keeps the download's file around for a second (Safari)", async () => {
    // No real download: only when the blob URL is let go.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    vi.useFakeTimers()
    const screen = await render(<BackupCodes codes={codes} />)

    // A plain click: the locator's click waits on timers, which are fake.
    const button = screen
      .getByRole("button", { name: "Download" })
      .element() as HTMLButtonElement
    button.click()
    await vi.advanceTimersByTimeAsync(500)
    const early = revoke.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)

    expect(early).toBe(0)
    expect(revoke).toHaveBeenCalledTimes(1)
  })
})
