import { readFileSync } from "node:fs"
import { join } from "node:path"

import { test, type Browser, type Page } from "@playwright/test"
import { createEmailVerificationToken } from "better-auth/api"

import { expect, open } from "./helpers"

// Share links (T25): the owner copies a read-only link, a visitor with no
// account opens it, the owner turns it off, and the link gives a friendly
// 404. Sharing needs a confirmed email, so the owner's email is confirmed
// with the dev server's secret: this runs locally, not against a Preview.

test.skip(
  Boolean(process.env.PREVIEW_URL),
  "Needs the dev server's auth secret to confirm the owner's email"
)

const password = "correct horse 1"

/** The confirmation link from the email, made with .dev.vars' secret. */
async function confirmationPath(email: string) {
  const vars = readFileSync(join(import.meta.dirname, "../.dev.vars"), "utf8")
  const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(vars)?.[1]?.trim()
  if (!secret) throw new Error("No BETTER_AUTH_SECRET in .dev.vars")
  const token = await createEmailVerificationToken(secret, email)
  return `/api/auth/verify-email?${new URLSearchParams({ token, callbackURL: "/" })}`
}

/** A page signed in as a new account with a confirmed email. */
async function confirmedOwner(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL })
  const email = `e2e-${crypto.randomUUID()}@example.test`
  for (let attempt = 1; ; attempt++) {
    const response = await context.request.post("/api/auth/sign-up/email", {
      headers: {
        origin: new URL(baseURL).origin,
        "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
      },
      data: { name: "Ana Tester", email, password },
    })
    if (response.ok()) break
    // Sign-ups are rate limited per IP (3 per 10 s).
    if (response.status() !== 429 || attempt === 5)
      throw new Error(`sign-up failed: ${response.status()}`)
    await new Promise((resolve) => setTimeout(resolve, 10_000))
  }
  const confirmed = await context.request.get(await confirmationPath(email), {
    maxRedirects: 0,
  })
  expect(confirmed.status()).toBe(302)
  return { page: await context.newPage(), email }
}

/** Copies the link from the Share menu; gives the address it copied. */
async function copyLink(page: Page) {
  const created = page.waitForResponse("**/api/rpc/share/create")
  await page.getByRole("button", { name: "Share" }).click()
  await page.getByRole("menuitem", { name: "Copy link" }).click()
  const { json } = (await (await created).json()) as {
    json: { token: string }
  }
  await expect(page.getByText("Link copied")).toBeVisible()
  return `/s/${json.token}`
}

test("a shared draft opens read-only for anyone, until it is turned off", async ({
  browser,
  browserName,
  baseURL,
}) => {
  // Several pages, each compiled on first use by the dev server.
  test.slow()
  const { page, email } = await confirmedOwner(browser, baseURL ?? "")
  if (browserName === "chromium")
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  const draftPath = new URL(page.url()).pathname

  const path = await copyLink(page)
  if (browserName === "chromium")
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL(path, page.url()).href
    )

  // A visitor with no account and no cookies.
  const visitor = await browser.newPage({ baseURL })
  const shown = await visitor.goto(path)
  expect(shown?.status()).toBe(200)
  expect(shown?.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
    "referrer-policy": "no-referrer",
  })
  await expect(
    visitor.locator('meta[name="robots"][content="noindex, nofollow"]')
  ).toHaveCount(1)
  await expect(
    visitor.getByRole("heading", {
      level: 1,
      name: "Mutual Non-Disclosure Agreement",
    })
  ).toBeVisible()
  await expect(visitor.getByText("Read only")).toBeVisible()
  await expect(visitor.getByText(/Common Paper/).first()).toBeVisible()
  // Nothing to edit, no chat, and nothing about the owner.
  await expect(visitor.getByRole("button", { name: /^Edit / })).toHaveCount(0)
  const html = (await visitor.content()) + (await shown?.text())
  expect(html).not.toContain(email)
  expect(html).not.toContain(draftPath.slice(3))
  await expect(
    visitor.getByRole("link", { name: "Draft your own" }).first()
  ).toHaveAttribute("href", "/")

  // The owner turns it off; the visitor's next load is a friendly 404.
  await page.getByRole("button", { name: "Share" }).click()
  // The menu shows the link that is on, to take by hand if a copy fails.
  await expect(page.getByText(new URL(path, page.url()).href)).toBeVisible()
  await page.getByRole("menuitem", { name: "Stop sharing" }).click()
  await expect(page.getByText("Link turned off")).toBeVisible()

  const gone = await visitor.reload()
  expect(gone?.status()).toBe(404)
  expect(gone?.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
  })
  await expect(
    visitor.getByRole("heading", { name: "This link doesn’t work" })
  ).toBeVisible()
})

test("a made-up link is a friendly 404", async ({ page }) => {
  const response = await page.goto("/s/AAAAAAAAAAAAAAAAAAAAAA")

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole("heading", { name: "This link doesn’t work" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Draft your own" }).first()
  ).toBeVisible()
})
