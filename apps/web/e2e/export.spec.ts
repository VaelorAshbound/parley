import { expect, open, test } from "./helpers"

// Downloading (T24). A guest can't download: the menu asks for a free
// account and comes back to the draft. The server refuses before it makes
// any file, so this never spends Browser Run time; the real PDF is checked by
// `pnpm test:workers:real` (export.real.test.ts).

test("a guest who wants the PDF is asked to make an account", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  const draftPath = new URL(page.url()).pathname

  await page.getByRole("button", { name: "Download" }).click()
  await page.getByRole("menuitem", { name: "PDF" }).click()

  await expect(page.getByRole("alert")).toContainText(
    "Create a free account to download. Your draft comes with you."
  )
  await page.getByRole("link", { name: "Create an account" }).click()
  await expect(page).toHaveURL(
    `/sign-up?redirect=${encodeURIComponent(draftPath)}`
  )
})
