import { describe, expect, test } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { ChatWelcome } from "./chat-welcome"

// A new draft's empty chat (T37): it says what to do next, and knows when
// the agreement is already picked.

describe("the chat's welcome", () => {
  test("before an agreement is picked, asks about the deal", async () => {
    const screen = await render(<ChatWelcome document={null} />)

    await expect
      .element(screen.getByText("Tell Parley about your deal"))
      .toBeVisible()
    await expect
      .element(screen.getByText(/Parley picks the agreement/))
      .toBeVisible()
  })

  test("with an agreement picked, offers to fill it in, by chat or by hand", async () => {
    const screen = await render(
      <ChatWelcome document="Mutual Non-Disclosure Agreement" />
    )

    await expect
      .element(
        screen.getByText("Let’s fill in your Mutual Non-Disclosure Agreement")
      )
      .toBeVisible()
    await expect
      .element(screen.getByText(/click any value in the document/))
      .toBeVisible()
  })
})
