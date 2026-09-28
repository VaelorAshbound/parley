import type { Locator, Page } from "@playwright/test"

import { draftOpened, expect, open, test } from "./helpers"

// The golden path with only a keyboard (spec §6), once as usual and once
// with reduced motion: start from a deal, answer the AI's questions by
// their keys, and undo the AI's change.

/**
 * Presses Tab (or Shift+Tab, for something above) until `target` has focus;
 * fails if it takes too many.
 */
async function tabTo(
  page: Page,
  target: Locator,
  key: "Tab" | "Shift+Tab" = "Tab",
  most = 30
) {
  for (let presses = 0; presses < most; presses++) {
    if (await target.evaluate((node) => node === document.activeElement)) return
    await page.keyboard.press(key)
  }
  await expect(target).toBeFocused()
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`reduced motion: ${reducedMotion}`, () => {
    test.use({ reducedMotion })

    test("the golden path with only a keyboard", async ({ page }) => {
      await open(page, "/")

      // The first Tab offers a way past the sidebar.
      await page.keyboard.press("Tab")
      const skip = page.getByRole("link", { name: "Skip to content" })
      await expect(skip).toBeFocused()
      await page.keyboard.press("Enter")

      await tabTo(
        page,
        page.getByRole("textbox", { name: "Describe your deal" })
      )
      await page.keyboard.type("Please ask me.")
      await page.keyboard.press("Enter")
      await draftOpened(page)

      // The questionnaire takes keys: a letter picks, Enter sends a typed
      // answer, and Skip is a Tab away.
      await expect(
        page.getByRole("group", { name: "How long should the agreement last?" })
      ).toBeVisible()
      await page.keyboard.press("a")
      const company = page.getByRole("textbox", {
        name: "What is your company called?",
      })
      // The next question takes focus, so it is read out; its box is a Tab away.
      await expect(
        page.getByRole("group", { name: "What is your company called?" })
      ).toBeFocused()
      await tabTo(page, company)
      await page.keyboard.type("Acme Robotics")
      await page.keyboard.press("Enter")
      await tabTo(page, page.getByRole("button", { name: "Skip" }))
      await page.keyboard.press("Enter")
      await expect(
        page.getByText("Thanks, that's everything I needed.")
      ).toBeVisible()

      // A change by the AI, undone from the keyboard.
      await tabTo(page, page.getByRole("textbox", { name: "Message" }))
      await page.keyboard.type("We share our roadmap with a vendor.")
      await page.keyboard.press("Enter")
      const undo = page.getByRole("button", { name: "Undo Purpose" })
      await expect(undo).toBeVisible()
      // Undo is in the chat, above the reply box.
      await tabTo(page, undo, "Shift+Tab")
      await page.keyboard.press("Enter")
      await expect(page.getByText("Undone")).toBeVisible()
    })
  })
}
