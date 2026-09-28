import type { Page } from "@playwright/test"

import {
  accountTest,
  draftOpened,
  expect,
  expectAccessible,
  fresh,
  open,
  test,
} from "./helpers"

// Accessibility (spec §6, T32): axe finds no serious or critical WCAG 2.2
// AA problem on any page or state, in light and in dark (contrast differs).
// Tagged @phone, so the phone projects check them at phone size too.

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
      ["the start page", "/"],
      ["pricing", "/pricing"],
      ["sign in", "/sign-in"],
      ["sign up", "/sign-up"],
      ["forgot password", "/forgot-password"],
      ["a share link that doesn't exist", "/s/not-a-real-token"],
    ] as const)
      fresh(`${name} is accessible`, async ({ page }) => {
        await open(page, path)
        await expectAccessible(page)
      })
  })

  test.describe(`${colorScheme} @phone`, () => {
    test.use({ colorScheme })

    test("a draft with no agreement yet is accessible", async ({ page }) => {
      await startWith(page, "Hello there.")
      await expect(
        page.getByText("I'm a scripted reply for tests.")
      ).toBeVisible()
      await expectAccessible(page)
    })

    test("a draft the AI filled, with its changes, is accessible", async ({
      page,
    }) => {
      await startWith(page, "We share our roadmap with a vendor.")
      await expect(
        page.getByRole("button", { name: "Undo Purpose" })
      ).toBeVisible()
      await expectAccessible(page)
    })

    test("an open questionnaire is accessible", async ({ page }) => {
      await startWith(page, "Please ask me.")
      await expect(
        page.getByRole("group", { name: "How long should the agreement last?" })
      ).toBeVisible()
      await expectAccessible(page)
    })
  })

  accountTest.describe(`${colorScheme} @phone`, () => {
    accountTest.use({ colorScheme })

    for (const [name, path] of [
      ["settings", "/settings"],
      ["all drafts", "/drafts"],
    ] as const)
      accountTest(`${name} is accessible`, async ({ page }) => {
        await open(page, path)
        await expectAccessible(page)
      })
  })
}
