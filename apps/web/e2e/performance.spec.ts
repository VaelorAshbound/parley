import { expect, test as base } from "@playwright/test"

import { test } from "./helpers"

// What the Lighthouse budgets (T35, `pnpm test:perf`) found, kept as fast
// checks: the page's own HTML must be enough to show it.

base.describe("search results", () => {
  for (const path of ["/", "/pricing", "/sign-in"]) {
    base(`${path} describes itself`, async ({ page }) => {
      await page.goto(path)

      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        /Parley.{40,}/
      )
    })
  }
})

test.describe("before the app's code runs", () => {
  // The server-rendered HTML alone: what shows while the scripts load
  // (Lighthouse's LCP waited 4 s on a phone for a hidden chat).
  test.use({ javaScriptEnabled: false })

  test("a new draft already says what to do next @phone", async ({ page }) => {
    const created = await page.request.post("/api/rpc/drafts/create", {
      headers: { "x-csrf-token": "orpc" },
      data: { json: { today: "2026-09-29" } },
    })
    const { json: draft } = (await created.json()) as { json: { id: string } }

    await page.goto(`/d/${draft.id}`)

    await expect(
      page
        .getByRole("region", { name: "Messages" })
        .getByText("Tell Parley about your deal")
    ).toBeVisible()
  })
})
