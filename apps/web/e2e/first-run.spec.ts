import { DISCLAIMER } from "@workspace/documents"

import { expect, open, test } from "./helpers"

// First run (T37): the start page as a visitor sees it, and the phone
// document's bottom bar with Share and Download (brand.md canvas).

test("the start page credits Common Paper and says it's a demo", async ({
  page,
}) => {
  await open(page, "/")

  await expect(page.getByText(DISCLAIMER)).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Common Paper" }).first()
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "Examples" }).getByRole("button")
  ).toHaveCount(4)
})

test("the start page fits a phone, with no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/")

  await expect(
    page.getByRole("heading", { level: 1, name: /Describe the deal/ })
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})

test("“Start drafting, free” takes you to the reply box", async ({ page }) => {
  await open(page, "/")

  await page.getByRole("button", { name: "Start drafting, free" }).click()

  await expect(
    page.getByRole("textbox", { name: "Describe your deal" })
  ).toBeFocused()
})

test("the start page doesn't shift while it loads", async ({ page }) => {
  await open(page, "/")
  const shift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            total += (entry as PerformanceEntry & { value: number }).value
        }).observe({ type: "layout-shift", buffered: true })
        // The reveal ends at about 4 s.
        setTimeout(() => resolve(total), 4500)
      })
  )

  // Same bar as the draft page (shell.spec.ts): only the font swap may move
  // text, a little.
  expect(shift).toBeLessThanOrEqual(0.02)
})

test("on a phone, Share and Download sit in a bar under the document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  await page.getByRole("button", { name: "Document" }).click()

  const bar = page.getByRole("toolbar", { name: "Share or download" })
  await expect(bar).toBeVisible()
  // One of each on screen: the header's pair is for wider screens.
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(1)
  const box = await bar.boundingBox()
  expect(box && box.y + box.height).toBeGreaterThan(812 - 40)

  await bar.getByRole("button", { name: "Download" }).click()
  await expect(page.getByRole("menuitem", { name: "PDF" })).toBeVisible()
})

test("on a wide screen, Share and Download stay in the header", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Mutual Non-Disclosure Agreement",
    })
  ).toBeVisible()

  await expect(
    page.getByRole("toolbar", { name: "Share or download" })
  ).toBeHidden()
  await expect(
    page
      .getByRole("region", { name: "Live document" })
      .getByRole("button", { name: "Download" })
  ).toBeVisible()
})
