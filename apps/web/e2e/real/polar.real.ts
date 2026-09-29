import { test } from "@playwright/test"

import {
  authPost,
  confirmedAccount,
  databaseUrl,
  expect,
  open,
} from "../helpers"

// Polar's sandbox (spec §6): "checkout → webhook → Pro unlocked". A new
// account with a confirmed email upgrades on /pricing, pays on Polar's
// hosted sandbox checkout with Stripe's test card, comes back, and Pro turns
// on when Polar's webhook reaches the Preview. Then the account is deleted,
// which cancels the subscription (T26), so the sandbox doesn't fill up.
// Polar sends its webhooks to one URL: PR #1's Preview (T26's notes). On any
// other Preview the payment goes through but Pro can't turn on.
// https://docs.polar.sh/integrate/sandbox

const password = "correct horse 1"

test("a Polar sandbox checkout turns on Pro, and deleting the account cancels it", async ({
  browser,
  baseURL,
}) => {
  test.skip(!databaseUrl, "Needs the Preview's database (E2E_DATABASE_URL)")
  const { context } = await confirmedAccount(browser, baseURL ?? "")
  const page = await context.newPage()

  await open(page, "/pricing")
  await page.getByRole("button", { name: "Upgrade to Pro" }).click()
  await page.waitForURL(/sandbox\.polar\.sh\/checkout\//, { timeout: 60_000 })

  // Polar refuses reserved domains like the account's example.test (and
  // leaves the field empty): pay as Resend's test inbox instead. Polar ties
  // the payment to the account by its id, not the email (T26).
  await page
    .getByRole("textbox", { name: "Email" })
    .fill("delivered+parley-polar@resend.dev")
  // Stripe's card fields live in its own frame; 4242… is its test card.
  const card = page
    .frameLocator('iframe[title="Secure payment input frame"]')
    .first()
  await card.getByPlaceholder("1234 1234 1234 1234").fill("4242424242424242")
  await card.getByPlaceholder("MM / YY").fill("12 / 34")
  await card.getByPlaceholder("CVC").fill("123")
  await page
    .getByRole("textbox", { name: "Cardholder name" })
    .fill("Ana Tester")
  // The country updates the checkout (tax); Subscribe waits for that.
  const updated = page.waitForResponse(
    (r) => r.request().method() === "PATCH" && /\/checkouts\//.test(r.url())
  )
  await page.getByRole("combobox").filter({ hasText: "Country" }).click()
  await page.getByRole("option", { name: "Germany" }).click()
  await updated
  // A click during the update is dropped without a word (seen, T33).
  const subscribe = page.getByRole("button", { name: "Subscribe now" })
  await expect(subscribe).toBeEnabled()
  const confirmed = page.waitForRequest(/\/checkouts\/client\/[^/]+\/confirm/)
  await subscribe.click()
  await confirmed

  await page.waitForURL(/\/pricing\?checkout_id=/, { timeout: 90_000 })
  const pro = page.getByText("You’re on Pro.", { exact: false })
  const slow = page.getByRole("button", { name: "Check again" })
  // The webhook usually lands within seconds; the page asks again after.
  await expect(pro.or(slow)).toBeVisible({ timeout: 60_000 })
  if (await slow.isVisible()) await slow.click()
  await expect(pro).toBeVisible({ timeout: 60_000 })

  await authPost(context.request, baseURL ?? "", "/api/auth/delete-user", {
    password,
  })
})
