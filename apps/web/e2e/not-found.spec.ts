import type { Page } from "@playwright/test"

import { accountTest, expect, fresh, test } from "./helpers"

// The not-found pages (PAR-36, found in T36's QA): a bad or unknown draft
// link and an unknown path are one friendly 404, a real page with a heading,
// a main landmark and a title, and a signed-out visitor can sign in from it.

const unknownDraft = "/d/01920000-0000-7000-8000-000000000000"

async function expectNotFoundPage(page: Page) {
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: "We couldn’t find that page" })
  ).toBeVisible()
  await expect(page).toHaveTitle("Page not found · Parley")
}

test("a draft link that isn't a draft id is a 404, not an error", async ({
  page,
}) => {
  const response = await page.goto("/d/not-a-real-id")

  expect(response?.status()).toBe(404)
  await expectNotFoundPage(page)
  await expect(page.getByText("Something went wrong")).toBeHidden()
  // The draft route's own 404, inside the app shell: the sidebar stays.
  await expect(
    page.getByRole("link", { name: "New draft", exact: true })
  ).toBeVisible()
})

test("an unknown draft's 404 keeps the app's sidebar", async ({ page }) => {
  const response = await page.goto(unknownDraft)

  expect(response?.status()).toBe(404)
  await expectNotFoundPage(page)
  // The sidebar's New draft, outside the page's <main>.
  await expect(
    page.getByRole("link", { name: "New draft", exact: true })
  ).toBeVisible()
})

fresh(
  "an unknown page is a 404 with a heading, a title and a way home",
  async ({ page }) => {
    const response = await page.goto("/nope-404")

    expect(response?.status()).toBe(404)
    await expectNotFoundPage(page)
    await expect(
      page.getByRole("link", { name: "Start a new draft" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Parley home" }).first()
    ).toBeVisible()
  }
)

fresh(
  "a signed-out visitor to a draft link can sign in and come back to it",
  async ({ page }) => {
    await page.goto(unknownDraft)

    await expectNotFoundPage(page)
    const signIn = page.getByRole("main").getByRole("link", { name: "Sign in" })
    await expect(signIn).toBeVisible()
    await expect(signIn).toHaveAttribute(
      "href",
      `/sign-in?redirect=${encodeURIComponent(unknownDraft)}`
    )
  }
)

test("a guest on a draft's 404 can sign in too", async ({ page }) => {
  await page.goto(unknownDraft)

  await expectNotFoundPage(page)
  await expect(
    page.getByRole("main").getByRole("link", { name: "Sign in" })
  ).toBeVisible()
})

accountTest(
  "an account on a draft's 404 isn't asked to sign in",
  async ({ page }) => {
    await page.goto(unknownDraft)

    await expectNotFoundPage(page)
    await expect(
      page.getByRole("main").getByRole("link", { name: "Start a new draft" })
    ).toBeVisible()
    await expect(
      page.getByRole("main").getByRole("link", { name: "Sign in" })
    ).toHaveCount(0)
  }
)
