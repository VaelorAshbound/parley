import type { Page } from "@playwright/test"

import { draftOpened, expect, fresh, open, test } from "./helpers"

// Visual baselines (spec §6, T32): the key screens in light and dark, on
// desktop and a phone. Compared only in Playwright's image (PW_VISUAL; see
// playwright.config.ts), in Chromium. Update them there with
// `pnpm test:e2e:docker e2e/visual.spec.ts --update-snapshots`.

fresh.beforeEach(({ browserName }) => {
  fresh.skip(browserName !== "chromium", "Baselines are Chromium's")
})

/**
 * Hides what changes from run to run: the draft history, and dates like the
 * Effective Date, which defaults to today.
 */
const steady = (page: Page) => ({
  mask: [
    page.locator("[data-slot=sidebar]"),
    // The date's whole line (its grandparent, the field's flex row), not the
    // text: "October 1" is narrower than "September 30", and a mask the
    // size of the text changed the screenshot from day to day.
    page.getByText(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/).locator("xpath=../.."),
  ],
  fullPage: false,
})

async function startWith(page: Page, deal: string) {
  await open(page, "/")
  await page.getByRole("textbox", { name: "Describe your deal" }).fill(deal)
  await page.keyboard.press("Enter")
  await draftOpened(page)
}

for (const colorScheme of ["light", "dark"] as const) {
  fresh.describe(`${colorScheme} @phone`, () => {
    fresh.use({ colorScheme })

    for (const [name, path] of [
      ["start", "/"],
      ["pricing", "/pricing"],
      ["sign-in", "/sign-in"],
    ] as const)
      fresh(`${name} looks right`, async ({ page }) => {
        await open(page, path)
        await expect(page).toHaveScreenshot(
          `${name}-${colorScheme}.png`,
          steady(page)
        )
      })
  })

  test.describe(`${colorScheme} @phone`, () => {
    test.use({ colorScheme })

    test("a draft the AI filled looks right", async ({ page }) => {
      await startWith(page, "We share our roadmap with a vendor.")
      await expect(
        page.getByRole("button", { name: "Undo Purpose" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(
        `draft-${colorScheme}.png`,
        steady(page)
      )
    })

    test("an open questionnaire looks right", async ({ page }) => {
      await startWith(page, "Please ask me.")
      await expect(
        page.getByRole("group", { name: "How long should the agreement last?" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(
        `questionnaire-${colorScheme}.png`,
        steady(page)
      )
    })
  })
}
