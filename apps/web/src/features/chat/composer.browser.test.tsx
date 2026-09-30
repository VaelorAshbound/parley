import { act, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { Composer } from "./composer"

/** Enter twice and a click on the button, all in one task (PAR-39). */
function sendThreeTimes(textarea: HTMLTextAreaElement, button: HTMLElement) {
  const enter = () =>
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  enter()
  enter()
  button.click()
}

test("sends once when sends come faster than React renders (PAR-39)", async () => {
  const onSend = vi.fn<(text: string) => void>()
  const screen = await render(<Composer busy={false} onSend={onSend} />)
  const box = screen.getByRole("textbox", { name: "Message" })
  await userEvent.fill(box, "double send check")

  sendThreeTimes(
    box.element() as HTMLTextAreaElement,
    screen.getByRole("button", { name: "Send" }).element() as HTMLElement
  )

  await expect.element(box).toHaveValue("")
  expect(onSend).toHaveBeenCalledExactlyOnceWith("double send check")
})

test("starts one draft when Start comes faster than React renders (PAR-39)", async () => {
  const onSend = vi.fn<(text: string) => void>()
  function Start() {
    const [busy, setBusy] = useState(false)
    return (
      <Composer
        variant="start"
        label="Describe your deal"
        busy={busy}
        onSend={(text) => {
          setBusy(true)
          onSend(text)
        }}
      />
    )
  }
  const screen = await render(<Start />)
  const box = screen.getByRole("textbox", { name: "Describe your deal" })
  await userEvent.fill(box, "We share our roadmap with a vendor.")

  sendThreeTimes(
    box.element() as HTMLTextAreaElement,
    screen
      .getByRole("button", { name: "Start drafting" })
      .element() as HTMLElement
  )

  await expect
    .element(screen.getByRole("button", { name: "Start drafting" }))
    .toHaveAttribute("aria-busy", "true")
  expect(onSend).toHaveBeenCalledOnce()
})

test("keeps what was typed before the page hydrated, and sends it", async () => {
  const onSend = vi.fn<(text: string) => void>()
  const box = (
    <Composer
      variant="start"
      label="Describe your deal"
      busy={false}
      onSend={onSend}
    />
  )
  // The server's HTML, typed into before React takes over (a slow phone:
  // the text shows, but React's copy of it is still empty).
  const container = document.createElement("div")
  container.innerHTML = renderToString(box)
  document.body.appendChild(container)
  const textarea = container.querySelector("textarea")
  if (!textarea) throw new Error("No text box")
  textarea.value = "We share our roadmap with a vendor."

  await act(async () => {
    hydrateRoot(container, box)
  })
  await userEvent.click(page.getByRole("button", { name: "Start drafting" }))

  expect(onSend).toHaveBeenCalledWith("We share our roadmap with a vendor.")
  container.remove()
})
