import type { Page } from "@playwright/test"

import { draftOpened, expect, open, test } from "./helpers"

// The chat with the scripted AI (T32; its script is in
// src/server/ai/scripted-model.ts): user stories 1, 2, 3 and 5 end to end.

async function startWith(page: Page, deal: string) {
  await open(page, "/")
  await page.getByRole("textbox", { name: "Describe your deal" }).fill(deal)
  await page.keyboard.press("Enter")
  await draftOpened(page)
}

const purpose = "Sharing our product roadmap with a vendor."

test("a deal in plain words becomes a live NDA, and the AI's change can be undone", async ({
  page,
}) => {
  await startWith(page, "We share our roadmap with a vendor.")

  const document = page.getByRole("region", { name: "Live document" })
  await expect(
    document.getByRole("heading", {
      level: 2,
      name: "Mutual Non-Disclosure Agreement",
    })
  ).toBeVisible()
  await expect(document).toContainText(purpose)
  await expect(
    page.getByText("I picked the Mutual NDA and filled in the purpose.")
  ).toBeVisible()

  await page.getByRole("button", { name: "Undo Purpose" }).click()

  await expect(page.getByText("Undone")).toBeVisible()
  await expect(document).not.toContainText(purpose)
})

test("the AI suggests an agreement with its reason and the ones that go with it", async ({
  page,
}) => {
  await startWith(page, "We sell cloud software to hospitals.")

  await expect(
    page
      .getByRole("region", { name: "Live document" })
      .getByRole("heading", { level: 2, name: "Cloud Service Agreement" })
      // The panel's title; the cover page and the terms repeat it.
      .first()
  ).toBeVisible()
  await expect(
    page.getByText("a CSA usually comes with an SLA and a DPA")
  ).toBeVisible()
})

test("the AI's questions: a letter picks, a typed answer, a skip, then it goes on", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)

  await page.getByRole("textbox", { name: "Message" }).fill("Please ask me.")
  await page.keyboard.press("Enter")

  await expect(
    page.getByRole("group", { name: "How long should the agreement last?" })
  ).toBeVisible()
  await expect(
    page.getByRole("progressbar", { name: "Key terms progress" })
  ).toBeVisible()
  await page.keyboard.press("a")
  const company = page.getByRole("textbox", {
    name: "What is your company called?",
  })
  await company.fill("Acme Robotics")
  await company.press("Enter")
  await expect(
    page.getByRole("group", { name: "Anything else to add?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Skip" }).click()

  await expect(
    page.getByText("Thanks, that's everything I needed.")
  ).toBeVisible()
  // The answers stay in the chat after a reload; nothing is asked again.
  await page.reload()
  await expect(
    page.getByText("Thanks, that's everything I needed.")
  ).toBeVisible()
  await expect(
    page.getByRole("group", { name: "How long should the agreement last?" })
  ).toBeHidden()
})
