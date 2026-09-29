import { test } from "@playwright/test"
import { Resend } from "resend"

import { authPost, expect, open } from "../helpers"

// Resend (spec §6): a real email from the app, read back and used. Signing
// up sends the confirmation email through Resend from mail.runtimedrift.dev
// to Resend's test inbox (delivered+…@resend.dev: it accepts and delivers,
// with no real person and no harm to the domain's reputation). The test
// finds it with Resend's API, opens its link, and the email is confirmed.
// Parley sends links, not codes, so the confirmation link is the "code".
// One send per run. The target needs RESEND_API_KEY (the Preview base
// config's sending key); this runner needs a key that can read emails.
// https://resend.com/docs/dashboard/emails/send-test-emails

const readKey = process.env.RESEND_API_KEY

/** The email to `to`, once Resend has it; its HTML. */
async function emailTo(resend: Resend, to: string) {
  for (let tries = 0; tries < 30; tries++) {
    const { data, error } = await resend.emails.list({ limit: 20 })
    if (error) throw new Error(`Resend list: ${error.name}`)
    const sent = data.data.find((each) => each.to.includes(to))
    if (sent) {
      const email = await resend.emails.get(sent.id)
      if (email.error) throw new Error(`Resend get: ${email.error.name}`)
      return { subject: sent.subject, html: email.data.html ?? "" }
    }
    // Sent after the response (waitUntil); Resend lists it within seconds.
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(
    "No email reached Resend. Does the target have RESEND_API_KEY?"
  )
}

test("signing up sends a real confirmation email, and its link confirms the address", async ({
  browser,
  baseURL,
}) => {
  test.skip(!readKey, "Needs RESEND_API_KEY to read the email back")
  const resend = new Resend(readKey)
  const email = `delivered+parley-${crypto.randomUUID().slice(0, 8)}@resend.dev`
  const context = await browser.newContext({ baseURL })

  await authPost(context.request, baseURL ?? "", "/api/auth/sign-up/email", {
    name: "Ana Tester",
    email,
    password: "correct horse 1",
    // Where the link lands, as the sign-up form sets it.
    callbackURL: new URL("/verify-email?redirect=%2F", baseURL).href,
  })
  const { subject, html } = await emailTo(resend, email)

  expect(subject).toBe("Confirm your email for Parley")
  const link = /href="([^"]*\/api\/auth\/verify-email\?[^"]+)"/
    .exec(html)?.[1]
    ?.replaceAll("&amp;", "&")
  expect(link, "the email's confirmation link").toBeDefined()
  expect(new URL(link ?? "").origin).toBe(new URL(baseURL ?? "").origin)
  const page = await context.newPage()
  await open(page, link ?? "")
  await expect(
    page.getByRole("heading", { level: 1, name: "Your email is confirmed" })
  ).toBeVisible()
})
