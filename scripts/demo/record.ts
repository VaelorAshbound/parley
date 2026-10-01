// Records the README's demo: a guest describes a deal, the real model picks
// the Mutual NDA and asks its questions, the draft fills in, then sign-up and
// the PDF. One real model conversation, about $0.005.
//
//   PORT=3001 pnpm dev                   (with OPENROUTER_API_KEY and a
//                                         Cloudflare login, for the PDF)
//   node scripts/demo/record.ts          → reports/demo/
//   node scripts/demo/gif.ts             → docs/demo.gif
//
// Local, not production: production's Turnstile stops automated browsers,
// and the PDF needs a confirmed email, which this script sets in the local
// database. The model replies differ each run; the answers below match
// questions by their words.

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { chromium } from "playwright"

import { connect } from "../../packages/db/src/client.ts"

const root = join(import.meta.dirname, "../..")
const out = join(root, "reports/demo")
const base = `http://localhost:${process.env.PORT ?? 3001}`
const database = "postgres://postgres:postgres@localhost:54320/parley"

const deal =
  "We're Northwind Labs, Inc. and we're about to show our product roadmap to Acme Robotics GmbH, a possible manufacturing partner. Both sides share confidential plans. Two years, Delaware law, courts in Wilmington."

/** Answers by the question's words; `them` is a question about Acme. */
const answers: [RegExp, (them: boolean) => string][] = [
  [/law|govern/i, () => "Delaware"],
  [/court|city|county|venue/i, () => "New Castle County, Delaware"],
  [/date|start/i, () => "Today"],
  [
    /email/i,
    (them) => (them ? "legal@acme-robotics.example" : "dana@northwind.example"),
  ],
  [/title/i, (them) => (them ? "Managing Director" : "CEO")],
  [
    /address/i,
    (them) =>
      them
        ? "Industriestraße 12, 80939 Munich, Germany"
        : "500 Market Street, San Francisco, CA 94105",
  ],
  [
    /company|legal name|organization|entity/i,
    (them) => (them ? "Acme Robotics GmbH" : "Northwind Labs, Inc."),
  ],
  [/sign|name/i, (them) => (them ? "Jonas Weber" : "Dana Whitfield")],
]

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: out, size: { width: 1280, height: 800 } },
  acceptDownloads: true,
})
const page = await context.newPage()
page.setDefaultTimeout(15_000)

// Seconds into the video: gif.ts speeds up the parts between them.
const start = Date.now()
const events: Record<string, number> = {}
function mark(name: string) {
  events[name] = (Date.now() - start) / 1000
  console.log(name, events[name])
}

await page.goto(base)
await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
mark("loaded")
await page.waitForTimeout(800)
const composer = page.getByRole("textbox", { name: "Describe your deal" })
await composer.click()
await composer.pressSequentially(deal, { delay: 18 })
await page.waitForTimeout(400)
await page.keyboard.press("Enter")
mark("sent")

const next = page.getByRole("button", { name: "Next", exact: true })
const send = page.getByRole("button", { name: "Send answers" })
const stop = page.getByRole("button", { name: "Stop" })
// The questionnaire's form, not the composer's.
const questionnaire = page
  .locator("form")
  .filter({ hasNot: page.getByRole("textbox", { name: "Message" }) })
  .last()

/** True when the reply ended without a questionnaire. */
async function replyDone() {
  await page.waitForTimeout(1500)
  await stop.waitFor({ state: "hidden", timeout: 180_000 })
  await page.waitForTimeout(1200)
  return !(await next.or(send).first().isVisible())
}

for (let round = 1; round <= 5 && !(await replyDone()); round += 1) {
  mark(`questions-${round}`)
  await page.waitForTimeout(900)
  for (let step = 0; step < 12; step += 1) {
    const item = questionnaire.getByRole("group").first()
    const question = (await item.innerText()).split("\n")[0] ?? ""
    const them = /acme|jonas/i.test(question)
    const choices = item.getByRole("radio")
    if ((await choices.count()) > 0) {
      // The first choice; picking one moves on by itself.
      await choices.first().check()
      await page.waitForTimeout(700)
    } else {
      const answer =
        answers.find(([words]) => words.test(question))?.[1](them) ?? "None"
      console.log(question, "→", answer)
      const input = item.getByRole("textbox").first()
      await input.click()
      await input.pressSequentially(answer, { delay: 14 })
      await page.waitForTimeout(300)
      if (await next.isVisible()) {
        await next.click()
        await page.waitForTimeout(350)
        continue
      }
    }
    if (!(await next.isVisible()) && (await send.isEnabled())) {
      await send.click()
      break
    }
  }
  mark(`answered-${round}`)
}
mark("done")

await page.waitForTimeout(1500)
await page.getByRole("button", { name: "Download PDF" }).click()
await page.waitForTimeout(2500)
mark("asked-to-sign-up")
await page.getByRole("link", { name: "Create an account" }).click()
await page.getByLabel("Name").waitFor()
await page.waitForTimeout(600)
const email = `dana.${Date.now()}@example.com`
await page.getByLabel("Name").pressSequentially("Dana Whitfield", { delay: 30 })
await page.getByLabel("Email").pressSequentially(email, { delay: 20 })
await page
  .getByLabel("Password", { exact: true })
  .pressSequentially("correct-horse-battery", { delay: 20 })
await page.waitForTimeout(600)
await page.getByRole("button", { name: "Create account" }).click()
await page
  .getByRole("heading", { level: 1, name: "Check your inbox" })
  .waitFor({ timeout: 30_000 })
mark("signed-up")
await page.waitForTimeout(1200)

// Confirmed off camera (the link would go to example.com). The session
// cookie caches the old user for 5 minutes: drop it, so the server reads
// the database again.
const db = await connect(database)
await db.$client.query(
  'update "user" set email_verified = true where email = $1',
  [email]
)
await db.$client.end()
await context.clearCookies({ name: /session_data/ })

await page.getByRole("link", { name: "Back to your draft" }).click()
await page.getByRole("button", { name: "Download PDF" }).waitFor()
mark("back")
await page.waitForTimeout(1000)
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60_000 }),
  page.getByRole("button", { name: "Download PDF" }).click(),
])
await download.saveAs(join(out, "nda.pdf"))
await page.waitForTimeout(1500)
mark("end")

await context.close()
await browser.close()
const video = await page.video()?.path()
writeFileSync(
  join(out, "events.json"),
  JSON.stringify({ video, events }, null, 2)
)
console.log(`Recorded ${video}`)
