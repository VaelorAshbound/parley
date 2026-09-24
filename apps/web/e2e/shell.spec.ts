import { test as fresh, type Page } from "@playwright/test"

import { expect, open, test } from "./helpers"

// The app shell (T15): start a draft, the three panes, the panel's open and
// closed states, the phone layout, and no layout shift.

async function startNda(page: Page) {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
}

test("the home page lists the eleven agreements", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: /Describe the deal/ })
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "The library" }).getByRole("listitem")
  ).toHaveCount(11)
})

fresh(
  "a first visit starts a guest and a draft beside the chat",
  async ({ page }) => {
    await startNda(page)

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Mutual Non-Disclosure Agreement",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Live document" })
    ).toBeVisible()
  }
)

test("the new draft is in the sidebar's history", async ({ page }) => {
  await startNda(page)
  const draftUrl = new URL(page.url()).pathname

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click()

  await expect(
    page
      .getByRole("list")
      .getByRole("link", { name: "Mutual Non-Disclosure Agreement" })
      .and(page.locator(`[href="${draftUrl}"]`))
  ).toBeVisible()
})

test("the document panel closes, stays closed on reload, and opens again", async ({
  page,
}) => {
  await startNda(page)

  await page
    .getByRole("region", { name: "Live document" })
    .getByRole("link", { name: "Close document" })
    .click()
  await expect(page).toHaveURL(/panel=closed/)
  await expect(page.getByRole("region", { name: "Live document" })).toBeHidden()

  await page.reload()
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
  await expect(page.getByRole("region", { name: "Live document" })).toBeHidden()

  await page.getByRole("link", { name: "Open document" }).click()
  await expect(
    page.getByRole("region", { name: "Live document" })
  ).toBeVisible()
})

test("a draft can be started with the keyboard alone", async ({ page }) => {
  await open(page, "/")
  const nda = page.getByRole("button", { name: /Mutual NDA/ })

  for (let press = 0; press < 20; press++) {
    if (await nda.evaluate((element) => element === document.activeElement))
      break
    await page.keyboard.press("Tab")
  }
  await expect(nda).toBeFocused()
  await page.keyboard.press("Enter")

  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
})

test("a draft that isn't yours is simply not found", async ({ page }) => {
  await page.goto("/d/01920000-0000-7000-8000-000000000000")

  await expect(
    page.getByText("We couldn’t find that page", { exact: true })
  ).toBeVisible()
})

test("on a phone, chat and document are two tabs", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await startNda(page)

  const chat = page.getByRole("region", { name: "Chat" })
  const document = page.getByRole("region", { name: "Live document" })
  await expect(chat).toBeVisible()
  await expect(document).toBeHidden()

  await page.getByRole("button", { name: "Document" }).click()
  await expect(document).toBeVisible()
  await expect(chat).toBeHidden()
  await expect(page).toHaveURL(/tab=document/)
})

test("loading a draft doesn't shift the layout", async ({ page }) => {
  await startNda(page)
  const url = page.url()

  await open(page, url)
  const shift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            total += (entry as PerformanceEntry & { value: number }).value
        }).observe({ type: "layout-shift", buffered: true })
        setTimeout(() => resolve(total), 1500)
      })
  )

  expect(shift).toBe(0)
})

for (const width of [1440, 1024, 375]) {
  test(`draft page at ${width} px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await startNda(page)
    await expect(page.getByRole("region", { name: "Chat" })).toBeVisible()

    await info.attach(`draft-${width}`, {
      body: await page.screenshot(),
      contentType: "image/png",
    })
  })
}
