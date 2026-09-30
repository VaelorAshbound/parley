import type { Page } from "@playwright/test"

import { draftOpened, expect, open, test } from "./helpers"

// PAR-6: the draft page never scrolls sideways, with the document panel open
// or closed, on a wide screen, a laptop and a phone. A closed panel used to
// keep its content laid out at zero width, spilling past the window's right
// edge; when the AI then changed the document, the panel "followed" the
// change by scrolling that hidden content into view, and every box around
// it, the chat included, slid sideways.

/** How far the page, `main` and the chat/document split reach or sit sideways. */
function sideways(page: Page) {
  return page.evaluate(async () => {
    // Let any scroll queued by the last render land first.
    for (let frame = 0; frame < 2; frame++)
      await new Promise(requestAnimationFrame)
    const root = document.documentElement
    const main = document.querySelector("main")
    const split = document.querySelector("[data-group]")
    return {
      pageOverflow: root.scrollWidth - root.clientWidth,
      pageScrolled: window.scrollX,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : null,
      mainScrolled: main?.scrollLeft ?? null,
      splitScrolled: split?.scrollLeft ?? null,
    }
  })
}

const still = {
  pageOverflow: 0,
  pageScrolled: 0,
  mainOverflow: 0,
  mainScrolled: 0,
  splitScrolled: 0,
}

for (const width of [1440, 1280, 390]) {
  for (const panel of ["open", "closed"] as const) {
    test(`a draft at ${width} px with the document ${panel} never scrolls sideways`, async ({
      page,
    }) => {
      // Reduced motion makes the panel's follow-the-change scroll instant,
      // so the check below sees where it lands, not a moment before it.
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.setViewportSize({ width, height: 900 })
      await open(page, "/")
      await page.getByRole("button", { name: /Mutual NDA/ }).click()
      await draftOpened(page)
      const draft = new URL(page.url()).pathname
      await open(page, panel === "closed" ? `${draft}?panel=closed` : draft)
      await page.getByRole("region", { name: "Chat" }).waitFor()

      expect(await sideways(page)).toEqual(still)

      // The AI changes the document: the panel follows the change.
      await page
        .getByRole("textbox", { name: "Message" })
        .fill("We share our roadmap with a vendor.")
      await page.keyboard.press("Enter")
      await expect(
        page.getByText("I picked the Mutual NDA and filled in the purpose.")
      ).toBeVisible()
      // Wait for the change to reach the document itself (hidden or not),
      // then measure once: a poll would pass on its first, pre-scroll sample.
      await expect(
        page.locator('[data-section="purpose"], [data-edit^="purpose"]').first()
      ).toContainText(/roadmap/i)

      expect(await sideways(page)).toEqual(still)
    })
  }
}
