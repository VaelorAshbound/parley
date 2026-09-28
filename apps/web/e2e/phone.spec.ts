import { expect, open, test } from "./helpers"

// User story 11 (T32): on a phone the whole path works. Chat and document
// are two tabs, the Document tab says when the AI changed it, and the
// sidebar is a drawer. @phone-only: desktop projects leave it out.

test("@phone-only a guest drafts an NDA on a phone, from chat to document and back", async ({
  page,
}) => {
  await open(page, "/")
  await page
    .getByRole("textbox", { name: "Describe your deal" })
    .fill("We share our roadmap with a vendor.")
  await page
    .getByRole("button", { name: "Start drafting", exact: true })
    .click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)

  const chat = page.getByRole("region", { name: "Chat" })
  const document = page.getByRole("region", { name: "Live document" })
  await expect(
    chat.getByText("I picked the Mutual NDA and filled in the purpose.")
  ).toBeVisible()
  await expect(document).toBeHidden()

  const documentTab = page.getByRole("button", { name: /^Document/ })
  await expect(documentTab).toHaveAccessibleName("Document (changed)")
  await documentTab.click()
  await expect(document).toContainText(
    "Sharing our product roadmap with a vendor."
  )
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible()

  await page.getByRole("button", { name: "Chat" }).click()
  await page.getByRole("button", { name: "Undo Purpose" }).click()
  await expect(chat.getByText("Undone")).toBeVisible()

  // The sidebar opens as a drawer over the page, and closes again.
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click()
  const drawer = page.getByRole("dialog")
  await expect(drawer.getByRole("link", { name: "New draft" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()
})
