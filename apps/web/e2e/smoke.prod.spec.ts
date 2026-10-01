import { test } from "@playwright/test"

import { draftOpened, expect, open } from "./helpers"

// The smoke test after a deploy (spec §6: "health, sign-in, and one real
// chat turn"), on the live site: .github/workflows/smoke.yml runs it on
// production once Workers Builds has deployed a commit, and `pnpm test:real`
// runs it on every PR's Preview too. It uses the real model (no scripted AI
// cookie). EXPECTED_COMMIT makes sure the site serves the deployed commit.
// Kept out of the fast e2e suite (playwright.config.ts testIgnore).

test("the site is up and serves the deployed commit", async ({ request }) => {
  const health = await request.get("/api/health")
  expect(await health.json()).toEqual({ ok: true })

  const expected = process.env.EXPECTED_COMMIT
  if (expected) {
    const version = (await (await request.get("/api/version")).json()) as {
      commit: string
    }
    expect(version.commit).toBe(expected)
  }
})

test("the start page and sign-in page render", async ({ page }) => {
  await open(page, "/")
  await expect(page).toHaveTitle("Parley")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await open(page, "/sign-in")
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to Parley" })
  ).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
})

test("one real chat turn fills in the document", async ({ page }) => {
  await open(page, "/")
  await page
    .getByRole("textbox", { name: "Describe your deal" })
    .fill("We're sharing our product roadmap with a vendor and need an NDA.")
  await page.keyboard.press("Enter")
  await draftOpened(page)

  await expect(
    page.getByRole("region", { name: "Live document" }).getByRole("heading", {
      level: 2,
      name: "Mutual Non-Disclosure Agreement",
    })
  ).toBeVisible({ timeout: 60_000 })
})
