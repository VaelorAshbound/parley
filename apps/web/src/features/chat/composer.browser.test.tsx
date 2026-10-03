import { act, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, test, vi } from "vite-plus/test"
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

describe("the 4,000-character limit (PAR-37)", () => {
  /** Prose `length` characters long, ending on a letter (nothing to trim). */
  const words = (length: number) =>
    "We share our roadmap with a vendor. ".repeat(200).slice(0, length - 1) +
    "x"

  test("keeps all of a long paste, says it's too long, and won't send it", async () => {
    const onSend = vi.fn<(text: string) => void>()
    const screen = await render(<Composer busy={false} onSend={onSend} />)
    const box = screen.getByRole("textbox", { name: "Message" })

    await userEvent.fill(box, words(5000))

    expect((box.element() as HTMLTextAreaElement).value).toHaveLength(5000)
    await expect
      .element(screen.getByText("Too long to send · 5,000 / 4,000"))
      .toBeVisible()
    await expect.element(box).toHaveAttribute("aria-invalid", "true")
    await expect
      .element(box)
      .toHaveAccessibleDescription(/Too long to send · 5,000 \/ 4,000/)
    await expect
      .element(screen.getByRole("button", { name: "Send" }))
      .toBeDisabled()
    await userEvent.keyboard("{Enter}")
    expect(onSend).not.toHaveBeenCalled()
  })

  test("counts the characters near the limit, and not before", async () => {
    const screen = await render(<Composer busy={false} onSend={() => {}} />)
    const box = screen.getByRole("textbox", { name: "Message" })

    await userEvent.fill(box, words(3500))
    expect(screen.getByText("/ 4,000", { exact: false }).query()).toBeNull()

    await userEvent.fill(box, words(3700))
    await expect.element(screen.getByText("3,700 / 4,000")).toBeVisible()
  })

  test("sends once the message is short enough again", async () => {
    const onSend = vi.fn<(text: string) => void>()
    const screen = await render(<Composer busy={false} onSend={onSend} />)
    const box = screen.getByRole("textbox", { name: "Message" })
    await userEvent.fill(box, words(4100))

    await userEvent.fill(box, words(4000))
    await screen.getByRole("button", { name: "Send" }).click()

    expect(onSend).toHaveBeenCalledOnce()
  })

  test("says so on the start page too", async () => {
    const screen = await render(
      <Composer
        variant="start"
        label="Describe your deal"
        busy={false}
        onSend={() => {}}
      />
    )

    await userEvent.fill(
      screen.getByRole("textbox", { name: "Describe your deal" }),
      words(4200)
    )

    await expect
      .element(screen.getByText("Too long to send · 4,200 / 4,000"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Start drafting" }))
      .toBeDisabled()
  })
})

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

test("can start again after a start that changed nothing, once the text is edited (PAR-39)", async () => {
  // A start page whose start did nothing (no busy, no page change): the
  // guard mustn't stay shut with no render to open it.
  const onSend = vi.fn<(text: string) => void>()
  const screen = await render(
    <Composer
      variant="start"
      label="Describe your deal"
      busy={false}
      onSend={onSend}
    />
  )
  const box = screen.getByRole("textbox", { name: "Describe your deal" })
  await userEvent.fill(box, "We share our roadmap")
  await userEvent.keyboard("{Enter}")
  expect(onSend).toHaveBeenCalledOnce()

  await userEvent.type(box, " with a vendor.")
  await userEvent.keyboard("{Enter}")

  expect(onSend).toHaveBeenLastCalledWith("We share our roadmap with a vendor.")
  expect(onSend).toHaveBeenCalledTimes(2)
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

describe("Enter while Parley is still answering (PAR-46)", () => {
  const hint = "Parley is still answering. Send when it’s done."
  /** What the form's polite live regions tell a screen reader. */
  const announced = (container: HTMLElement) =>
    [...container.querySelectorAll("[aria-live=polite]")]
      .map((region) => region.textContent)
      .join("")

  test("keeps the text and says why it waits, on screen and to a screen reader", async () => {
    const onSend = vi.fn<(text: string) => void>()
    const screen = await render(
      <Composer busy onSend={onSend} onStop={() => {}} />
    )
    const box = screen.getByRole("textbox", { name: "Message" })
    expect(announced(screen.container)).toBe("")

    await userEvent.type(box, "And the term?{Enter}")

    expect(onSend).not.toHaveBeenCalled()
    await expect.element(box).toHaveValue("And the term?")
    await expect.element(screen.getByText(hint)).toBeVisible()
    await expect
      .element(screen.getByText(hint))
      .toHaveAttribute("aria-live", "polite")
    expect(announced(screen.container)).toBe(hint)
  })

  test("goes when the turn ends, and the kept text sends", async () => {
    const onSend = vi.fn<(text: string) => void>()
    const screen = await render(
      <Composer busy onSend={onSend} onStop={() => {}} />
    )
    const box = screen.getByRole("textbox", { name: "Message" })
    await userEvent.type(box, "And the term?{Enter}")
    await expect.element(screen.getByText(hint)).toBeVisible()

    await screen.rerender(<Composer busy={false} onSend={onSend} />)

    expect(screen.getByText(hint).query()).toBeNull()
    expect(announced(screen.container)).toBe("")
    await userEvent.keyboard("{Enter}")
    expect(onSend).toHaveBeenCalledExactlyOnceWith("And the term?")
  })

  test("never shows while Parley is idle, nor before Enter in a new turn", async () => {
    const screen = await render(<Composer busy={false} onSend={() => {}} />)
    const box = screen.getByRole("textbox", { name: "Message" })
    await userEvent.type(box, "{Enter}Hello{Enter}")
    expect(screen.getByText(hint).query()).toBeNull()

    await screen.rerender(<Composer busy onSend={() => {}} onStop={() => {}} />)
    await userEvent.type(box, "More")

    expect(screen.getByText(hint).query()).toBeNull()
    expect(announced(screen.container)).toBe("")
  })
})
