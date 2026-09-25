import { readFileSync } from "node:fs"
import { join } from "node:path"

import { test as fresh, type Page } from "@playwright/test"
import { createEmailVerificationToken } from "better-auth/api"

import { expect, open } from "./helpers"

// Signing up, in and out (T21), in a real browser against the dev server
// or a Preview. Turnstile runs with Cloudflare's "always passes" test key
// there. Addresses are on example.test, so no email is ever sent.

// Sign-up and sign-in allow 3 tries per 10 s per IP: one at a time.
fresh.describe.configure({ mode: "serial" })

const password = "correct horse 1"

function newEmail() {
  return `e2e-${crypto.randomUUID()}@example.test`
}

async function startNda(page: Page) {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  return new URL(page.url()).pathname
}

/** Presses the button, and again after a wait if the IP hit the limit. */
async function submit(page: Page, name: string | RegExp) {
  for (let attempt = 1; ; attempt++) {
    await page.getByRole("button", { name, exact: true }).click()
    const limited = page.getByText("Too many tries", { exact: false })
    const left = page.waitForURL((url) => !/sign-(in|up)/.test(url.pathname))
    const outcome = await Promise.race([
      left.then(() => "left" as const),
      limited.waitFor().then(() => "limited" as const),
    ])
    if (outcome === "left" || attempt === 3) return
    await page.waitForTimeout(10_000)
  }
}

async function signUp(page: Page, email: string) {
  await page.getByLabel("Name").fill("Ana Tester")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await submit(page, "Create account")
  await expect(
    page.getByRole("heading", { level: 1, name: "Check your inbox" })
  ).toBeVisible()
  // Signing up loads the next page afresh.
  await hydrated(page)
}

function hydrated(page: Page) {
  return page.locator("html[data-hydrated]").waitFor({ state: "attached" })
}

/**
 * The link from the confirmation email, made with the dev server's secret
 * (apps/web/.dev.vars): the email itself isn't sent to test addresses. Not
 * available against a Preview, whose secret CI doesn't have.
 */
async function confirmationLink(email: string, callbackPath: string) {
  const vars = readFileSync(join(import.meta.dirname, "../.dev.vars"), "utf8")
  const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(vars)?.[1]?.trim()
  if (!secret) throw new Error("No BETTER_AUTH_SECRET in .dev.vars")
  const token = await createEmailVerificationToken(secret, email)
  return `/api/auth/verify-email?${new URLSearchParams({ token, callbackURL: callbackPath })}`
}

fresh(
  "a guest who signs up keeps their draft and can confirm their email",
  async ({ page }) => {
    // Several pages, each compiled on first use by the dev server.
    fresh.slow()
    const draftPath = await startNda(page)

    await page.getByRole("link", { name: "Sign in to save" }).click()
    await page.getByRole("link", { name: "Create an account" }).click()
    await expect(page.getByText("Save your draft and chat")).toBeVisible()
    const email = newEmail()
    await signUp(page, email)
    await expect(page.getByText(`We sent a link to ${email}`)).toBeVisible()

    await page.getByRole("link", { name: "Back to your draft" }).click()
    await expect(page).toHaveURL(draftPath)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Mutual Non-Disclosure Agreement",
      })
    ).toBeVisible()
    // The draft is the account's now: it is in the sidebar under its name.
    await expect(page.getByRole("button", { name: "Ana Tester" })).toBeVisible()

    fresh.skip(
      Boolean(process.env.PREVIEW_URL),
      "Needs the dev server's auth secret to make the email's link"
    )
    await open(
      page,
      await confirmationLink(
        email,
        `/verify-email?${new URLSearchParams({ redirect: draftPath })}`
      )
    )
    await expect(
      page.getByRole("heading", { level: 1, name: "Your email is confirmed" })
    ).toBeVisible()
    await page.getByRole("link", { name: "Continue" }).click()
    await expect(page).toHaveURL(draftPath)
  }
)

fresh("signing out and back in", async ({ page }) => {
  fresh.slow()
  await open(page, "/sign-up")
  const email = newEmail()
  await signUp(page, email)
  await page.getByRole("link", { name: "Back to your draft" }).click()
  await page.waitForURL("/")

  await page.getByRole("button", { name: "Ana Tester" }).click()
  // Signing out loads the page afresh.
  const reload = page.waitForEvent("framenavigated")
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await reload
  await hydrated(page)

  await page.getByRole("link", { name: "Sign in to save" }).click()
  await page.waitForURL(/\/sign-in/)
  await hydrated(page)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("wrong password 1")
  // Email was used last on this browser: its button says so.
  const signIn = /^Sign in Last used$/
  await page.getByRole("button", { name: signIn }).click()
  await expect(
    page.getByText("That email and password don’t match.")
  ).toBeVisible()

  // A second try gets a new Turnstile token (each works once).
  await page.getByLabel("Password", { exact: true }).fill(password)
  await submit(page, signIn)
  await expect(page.getByRole("button", { name: "Ana Tester" })).toBeVisible()
})

fresh("the sign-up form explains what's missing", async ({ page }) => {
  await open(page, "/sign-up")

  await page.getByLabel("Password", { exact: true }).fill("short")
  await page.getByRole("button", { name: "Create account" }).click()

  await expect(page.getByText("Please enter your name.")).toBeVisible()
  await expect(page.getByText("Please enter a valid email.")).toBeVisible()
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible()
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true")
})

fresh("a link to another site after sign-in is ignored", async ({ page }) => {
  await open(page, "/sign-in?redirect=//evil.example")

  await expect(
    page.getByRole("link", { name: "Create an account" })
  ).toHaveAttribute("href", "/sign-up?redirect=%2F")
})

fresh(
  "a Google or GitHub sign-up that comes back with a problem says so",
  async ({ page }) => {
    // Better Auth sends the browser back to the page it left from.
    await open(page, "/sign-up?error=account_not_linked")

    await expect(
      page.getByText("This email already has a Parley account.", {
        exact: false,
      })
    ).toBeVisible()
  }
)
