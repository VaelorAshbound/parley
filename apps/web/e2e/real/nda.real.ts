import { readFile } from "node:fs/promises"

import { test, type Locator, type Page } from "@playwright/test"
import { extractText, getDocumentProxy } from "unpdf"

import {
  confirmedAccount,
  databaseUrl,
  draftOpened,
  expect,
  open,
} from "../helpers"
import { spend } from "./spend"

// Spec §6: "Real streaming chat for a full Mutual NDA from start to PDF on
// every PR." The real model (the Preview's capped test key), the real
// tools, the Preview's Neon branch, and a real Browser Run print. The deal
// is told in one go, like evals/cases/nda.ts; if the model still asks, the
// test answers with the usual choices.

const deal = `We need a Mutual NDA. We're Acme Robotics and we're about to share our product roadmap with a supplier, Northwind Labs. Both sides may share confidential information.
Our signer: Ana Diaz, CEO, ana@acme.test. Theirs: Bo Chen, Head of Partnerships, bo@northwind.test.
The NDA lasts 2 years and secrets stay protected for 3 years. Delaware law, courts in New Castle County.
Use the usual choice for anything I haven't said.`

/** Waits for the AI's turn to end (its Stop button goes away). */
async function turnEnded(page: Page) {
  const stop = page.getByRole("button", { name: "Stop" })
  await stop.waitFor({ timeout: 10_000 }).catch(() => {})
  await expect(stop).toBeHidden({ timeout: 3 * 60_000 })
}

/**
 * Answers the AI's open questionnaire with the first choice, or "the usual
 * choice" typed in; false if there is none.
 */
async function answerQuestions(page: Page, chat: Locator) {
  const card = chat
    .getByRole("region")
    .filter({ has: page.getByRole("progressbar") })
    .last()
  if (!(await card.isVisible())) return false
  for (let step = 0; step < 30; step++) {
    // Sent: the card folds into a one-line summary.
    if (!(await card.isVisible())) return true
    const send = card.getByRole("button", { name: "Send answers" })
    const choice = card.getByRole("radio").or(card.getByRole("checkbox"))
    const typed = card.getByRole("textbox")
    if (await choice.first().isVisible()) await choice.first().check()
    else if (await typed.first().isVisible()) {
      await typed.first().fill("The usual choice.")
      await typed.first().press("Enter")
    }
    // A picked choice moves on by itself; the last one waits for Send.
    await page.waitForTimeout(500)
    if (await send.isVisible()) {
      await send.click()
      return true
    }
    const next = card.getByRole("button", { name: "Next" })
    if (await next.isVisible()) await next.click()
  }
  throw new Error("The questionnaire never offered Send answers")
}

test("the real model drafts a whole Mutual NDA from one message, and it downloads as a PDF", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(!databaseUrl, "Needs the Preview's database (E2E_DATABASE_URL)")
  const noteSpend = await spend(testInfo)
  // Downloading needs an account with a confirmed email.
  const { context } = await confirmedAccount(browser, baseURL ?? "")
  const page = await context.newPage()

  await open(page, "/")
  await page.getByRole("textbox", { name: "Describe your deal" }).fill(deal)
  await page.keyboard.press("Enter")
  await draftOpened(page)

  const chat = page.getByRole("region", { name: "Chat" })
  const complete = chat.getByText(
    "Your Mutual Non-Disclosure Agreement is complete"
  )
  for (let turn = 1; turn <= 6; turn++) {
    await turnEnded(page)
    if (await complete.isVisible()) break
    if (await answerQuestions(page, chat)) continue
    await page
      .getByRole("textbox", { name: "Message" })
      .fill("Use the usual choice for anything still missing, and finish it.")
    await page.keyboard.press("Enter")
  }
  await expect(complete).toBeVisible()
  const document = page.getByRole("region", { name: "Live document" })
  for (const value of [
    "Acme Robotics",
    "Northwind Labs",
    "Ana Diaz",
    "Bo Chen",
  ])
    await expect(document).toContainText(value)

  const download = page.waitForEvent("download")
  await chat.getByRole("button", { name: "Download PDF" }).click()
  const file = await download
  const bytes = new Uint8Array(await readFile(await file.path()))
  expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-")
  const { text } = await extractText(await getDocumentProxy(bytes), {
    mergePages: true,
  })
  for (const value of [
    "Mutual Non-Disclosure Agreement",
    "Acme Robotics",
    "Northwind Labs",
    "Delaware",
  ])
    expect(text).toContain(value)
  await noteSpend()
})
