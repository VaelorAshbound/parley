import { schema } from "@workspace/db"
import { eq } from "drizzle-orm"

import {
  confirmedAccount,
  databaseUrl,
  expect,
  open,
  test,
  withDatabase,
} from "./helpers"

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

test("the return from checkout drops Polar's session token from the address", async ({
  page,
}) => {
  // Polar adds its customer portal token; kept in the address it lands in
  // history and in any copied link (PAR-43).
  await open(
    page,
    "/pricing?checkout_id=abc&customer_session_token=polar_cst_x"
  )

  await expect(page).toHaveURL(/\/pricing\?checkout_id=abc$/)
  // Replaced, not added: Back doesn't bring the token back.
  await page.goBack()
  expect(page.url()).not.toContain("customer_session_token")
})

test("a Free user who paid before finds Billing in the account menu", async ({
  browser,
  baseURL,
}) => {
  // Past invoices live in Polar's portal (PAR-21). Polar's webhook keeps
  // the customer id on the user row; Pro has ended, so the plan is Free.
  test.skip(!databaseUrl, "Needs the app's database (E2E_DATABASE_URL)")
  const { context, email } = await confirmedAccount(browser, baseURL ?? "")
  await withDatabase((db) =>
    db
      .update(schema.user)
      .set({ polarCustomerId: `e2e-${crypto.randomUUID()}` })
      .where(eq(schema.user.email, email))
  )
  const page = await context.newPage()
  await open(page, "/")

  const menu = page.getByRole("button", { name: /Ana Tester/ })
  await expect(menu).toContainText("Free")
  await menu.click()

  await expect(
    page.getByRole("menuitem", { name: "Upgrade to Pro" })
  ).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Billing" })).toBeVisible()
  await context.close()
})

test("a Free user who never paid gets no Billing item", async ({
  browser,
  baseURL,
}) => {
  test.skip(!databaseUrl, "Needs the app's database (E2E_DATABASE_URL)")
  const { context } = await confirmedAccount(browser, baseURL ?? "")
  const page = await context.newPage()
  await open(page, "/")

  await page.getByRole("button", { name: /Ana Tester/ }).click()

  await expect(
    page.getByRole("menuitem", { name: "Upgrade to Pro" })
  ).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Billing" })).toHaveCount(0)
  await context.close()
})
