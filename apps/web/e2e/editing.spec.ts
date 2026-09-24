import type { Page } from "@playwright/test"

import { expect, open, test } from "./helpers"

// Story 4 (T16): click any field in the live document and edit it by hand.
// A whole Mutual NDA is filled this way, and survives a reload.

async function startNda(page: Page) {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  return page.getByRole("region", { name: "Live document" })
}

test("a whole NDA can be filled by hand, and it survives a reload", async ({
  page,
}) => {
  const doc = await startNda(page)
  const editor = doc.getByRole("form")
  const saved = () => expect(editor).toHaveCount(0)

  await doc.getByRole("button", { name: "Edit Purpose" }).click()
  await editor.getByRole("textbox").fill("Evaluating a reseller partnership.")
  await editor.getByRole("textbox").press("Enter")
  await saved()

  await doc.getByRole("button", { name: "Edit MNDA Term" }).click()
  await editor.getByRole("spinbutton", { name: "MNDA length" }).fill("2")
  await editor.getByRole("button", { name: "Save" }).click()
  await saved()

  await doc
    .getByRole("button", { name: "Edit Term of Confidentiality" })
    .click()
  await editor.getByRole("radio", { name: "In perpetuity." }).click()
  await editor.getByRole("button", { name: "Save" }).click()
  await saved()

  await doc
    .getByRole("button", { name: "Edit Governing Law & Jurisdiction" })
    .click()
  await editor.getByRole("combobox", { name: "State" }).fill("Delaw")
  await page.getByRole("option", { name: "Delaware" }).click()
  await editor.getByRole("textbox", { name: "Courts" }).fill("New Castle")
  await editor.getByRole("textbox", { name: "Courts" }).press("Enter")
  await saved()

  await doc.getByRole("button", { name: "Edit MNDA Modifications" }).click()
  await editor.getByRole("textbox").fill("None.")
  await editor.getByRole("textbox").press("Enter")
  await saved()

  for (const [party, company, person, email] of [
    ["Party 1", "Acme Analytics, Inc.", "Ana Diaz", "legal@acme.test"],
    ["Party 2", "Bolt Retail LLC", "Bo Chen", "bo@bolt.test"],
  ] as const) {
    await doc
      .getByRole("button", { name: `Edit ${party}: Company, empty` })
      .click()
    await editor.getByRole("textbox", { name: "Company" }).fill(company)
    await editor.getByRole("textbox", { name: "Name" }).fill(person)
    await editor.getByRole("textbox", { name: "Title" }).fill("CEO")
    await editor.getByRole("textbox", { name: "Email" }).fill(email)
    await editor.getByRole("textbox", { name: "Email" }).press("Enter")
    await saved()
  }

  const filled = async () => {
    // Options not picked keep their blanks, faded, as the PDF prints them.
    await expect(
      doc.locator("[data-empty]:not([data-unchosen] [data-empty])")
    ).toHaveCount(0)
    await expect(
      doc.getByText("Evaluating a reseller partnership.")
    ).toBeVisible()
    await expect(
      doc.getByText("courts located in New Castle, DE")
    ).toBeVisible()
    await expect(
      doc.getByRole("button", {
        name: "Edit Party 2: Notice address, bo@bolt.test",
      })
    ).toBeVisible()
  }
  await filled()
  // Saves go one after another; reload once the last has landed.
  await expect(
    page.getByRole("status").filter({ hasText: "Saving" })
  ).toHaveCount(0, { timeout: 15_000 })

  await page.reload()
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
  await filled()
})

test("a wrong value shows its error and is not saved", async ({ page }) => {
  const doc = await startNda(page)
  const editor = doc.getByRole("form")

  await doc
    .getByRole("button", { name: "Edit Party 1: Notice Address, empty" })
    .click()
  await editor.getByRole("textbox", { name: "Email" }).fill("ana at acme")
  await editor.getByRole("textbox", { name: "Email" }).press("Enter")

  await expect(editor.getByText("Use a real email address.")).toBeVisible()
  await editor.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect(
    doc.getByRole("button", { name: "Edit Party 1: Notice Address, empty" })
  ).toBeFocused()
})

test("a linked term in the standard terms shows its value and opens its editor", async ({
  page,
}) => {
  const doc = await startNda(page)

  const term = doc.getByRole("button", { name: /^Purpose \(Purpose: / }).first()
  await term.hover()
  await expect(page.getByText(/^Purpose: Evaluating whether/)).toBeVisible()

  await term.click()
  await expect(doc.getByRole("form", { name: "Edit Purpose" })).toBeVisible()
  await expect(page).toHaveURL(/field=purpose/)
})
