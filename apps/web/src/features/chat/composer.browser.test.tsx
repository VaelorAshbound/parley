import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"

import { Composer } from "./composer"

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
