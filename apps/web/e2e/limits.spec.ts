import { expect, open, test } from "./helpers"

// Spec §2 Limits in the browser (T27). The Worker tests check each limit at
// its edge; these check what a person sees when they reach one.

test("a guest with a draft is asked to make an account for a second", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)

  await open(page, "/")
  await page.getByRole("button", { name: /Pilot Agreement/ }).click()

  const problem = page.getByRole("alert")
  await expect(problem).toContainText("Guests keep one draft.")
  await expect(
    problem.getByRole("link", { name: "Create an account" })
  ).toHaveAttribute("href", "/sign-up")
  await expect(page).toHaveURL("/")
})
