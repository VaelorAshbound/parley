import { expect, open, test } from "./helpers"

// Pricing (T26): what a visitor sees, and the way to it from the start page.
// Checkout itself runs in Polar's sandbox (billing.test.ts, and the real
// run in T26's notes).

test("a visitor finds Pricing from the start page and sees both plans", async ({
  page,
}) => {
  await open(page, "/")

  await page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Pricing" })
    .click()

  await expect(
    page.getByRole("heading", { level: 1, name: /Free to draft/ })
  ).toBeVisible()
  const plans = page.getByRole("region", { name: "Plans" })
  await expect(plans.getByRole("heading", { name: "Free" })).toBeVisible()
  await expect(plans.getByRole("heading", { name: "Pro" })).toBeVisible()
  // Checkout is for accounts: both ways in start with signing up.
  await expect(
    plans.getByRole("link", { name: "Upgrade to Pro" })
  ).toHaveAttribute("href", "/sign-up?redirect=%2Fpricing")
})

test("Pricing fits a phone, with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/pricing")

  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(375)
})
