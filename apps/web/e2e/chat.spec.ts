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

test("a reload while Parley answers shows the reply so far once it is saved, with no second reload (PAR-33)", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)
  await page
    .getByRole("textbox", { name: "Message" })
    .fill("Give me the slow reply.")
  await page.keyboard.press("Enter")
  // Parley has written its first sentence; the second is seconds away.
  const first = page.getByText("Here is the slow reply", { exact: false })
  await expect(first).toBeVisible()

  // The reload closes the stream, and the dev server passes that on as in
  // production: the model stops (its chat_turn line says "aborted") and the
  // reply so far is saved. The page loads before or after that save; either
  // way it shows the saved reply without another reload.
  await page.reload()

  await expect(page.getByText("Give me the slow reply.")).toBeVisible()
  await expect(first).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("Thinking…")).toBeHidden()
  await expect(
    page.getByText("Parley couldn’t answer.", { exact: false })
  ).toBeHidden()
})

test("a stopped reply says Stopped, after a reload too, and Try again answers it whole (PAR-47)", async ({
  page,
}) => {
  // Two slow replies, each a few seconds long.
  test.setTimeout(90_000)
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)
  const box = page.getByRole("textbox", { name: "Message" })
  await box.fill("Give me the slow reply.")
  await page.keyboard.press("Enter")
  const first = page.getByText("Here is the slow reply", { exact: false })
  await expect(first).toBeVisible()

  // Enter while Parley answers keeps the text and says why (PAR-46).
  await box.fill("And the term?")
  await page.keyboard.press("Enter")
  await expect(
    page.getByText("Parley is still answering. Send when it’s done.")
  ).toBeVisible()
  await expect(box).toHaveValue("And the term?")

  await page.getByRole("button", { name: "Stop" }).click()
  const stopped = page.getByText("Stopped", { exact: true })
  await expect(stopped).toBeVisible()
  await expect(
    page.getByText("Parley is still answering.", { exact: false })
  ).toBeHidden()

  // The server saved it marked: a later visit says so too.
  await page.reload()
  await expect(first).toBeVisible()
  await expect(stopped).toBeVisible()

  await page.getByRole("button", { name: "Try again" }).click()

  await expect(page.getByText("It goes on after the reload.")).toBeVisible({
    timeout: 20_000,
  })
  await expect(stopped).toBeHidden()
  // The turn ends a moment after its last words; a reload before that
  // would stop it again.
  await expect(page.getByRole("button", { name: "Stop" })).toBeHidden()
  await page.reload()
  await expect(page.getByText("It goes on after the reload.")).toBeVisible()
  await expect(stopped).toBeHidden()
})
