import { expect, test } from "@playwright/test"

test("the home page renders the app name", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: "Parley" })
  ).toBeVisible()
})

test("the API answers the health check", async ({ request }) => {
  const response = await request.get("/api/health")

  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ ok: true })
})
