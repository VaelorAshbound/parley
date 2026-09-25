import {
  test as fresh,
  type APIRequestContext,
  type Page,
} from "@playwright/test"
import { connect, schema } from "@workspace/db"
import { and, eq, like } from "drizzle-orm"

import { expect, open } from "./helpers"

// Settings and the password flows (T23), in a real browser against the dev
// server. Addresses are on example.test, so no email is ever sent; the reset
// link's token is read from the dev database instead.

// Sign-up and sign-in allow 3 tries per 10 s per IP: one at a time.
fresh.describe.configure({ mode: "serial" })

const password = "correct horse 1"
const newPassword = "battery staple 2"

/** Cloudflare's dummy Turnstile token: the dev server uses the test keys. */
const captcha = { "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX" }

/**
 * Posts to Better Auth from this request context (its cookies are the
 * browser's), and waits and tries again when the IP hit the limit.
 */
async function authPost(
  request: APIRequestContext,
  origin: string,
  path: string,
  data: object
) {
  for (let attempt = 1; ; attempt++) {
    const response = await request.post(`/api/auth${path}`, {
      headers: { origin, ...captcha },
      data,
    })
    if (response.ok()) return
    if (response.status() !== 429 || attempt === 5)
      throw new Error(`${path} failed: ${response.status()}`)
    const wait = Number(response.headers()["x-retry-after"] ?? 1)
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
  }
}

/** A new account, signed in on this page, made through the API. */
async function signUp(page: Page) {
  const email = `e2e-${crypto.randomUUID()}@example.test`
  await authPost(page.request, new URL(page.url()).origin, "/sign-up/email", {
    name: "Ana Tester",
    email,
    password,
  })
  return email
}

/** Opens a page first, so API calls carry this origin. */
async function signUpOn(page: Page, path: string) {
  await open(page, "/sign-in")
  const email = await signUp(page)
  await open(page, path)
  return email
}

/** Presses a button, and again after a wait if the IP hit the limit. */
async function submitAuth(page: Page, name: string | RegExp) {
  for (let attempt = 1; ; attempt++) {
    await page.getByRole("button", { name, exact: true }).click()
    const limited = page.getByText("Too many tries", { exact: false })
    const left = page.waitForURL((url) => !/sign-in/.test(url.pathname))
    const outcome = await Promise.race([
      left.then(() => "left" as const),
      limited.waitFor().then(() => "limited" as const),
    ])
    if (outcome === "left" || attempt === 3) return
    await page.waitForTimeout(10_000)
  }
}

async function signIn(page: Page, email: string, pass: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(pass)
  await submitAuth(page, /^Sign in/)
  await expect(page.getByRole("button", { name: "Ana Tester" })).toBeVisible()
}

/**
 * The token in the reset email, from the dev database (the email itself
 * isn't sent to test addresses). Not available against a Preview.
 */
async function resetToken(email: string) {
  const db = await connect(
    "postgres://postgres:postgres@localhost:54320/parley"
  )
  try {
    const [user] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    const [row] = await db
      .select({ identifier: schema.verification.identifier })
      .from(schema.verification)
      .where(
        and(
          eq(schema.verification.value, user?.id ?? ""),
          like(schema.verification.identifier, "reset-password:%")
        )
      )
    const token = row?.identifier.replace("reset-password:", "")
    if (!token) throw new Error("No reset token in the dev database")
    return token
  } finally {
    await db.$client.end()
  }
}

fresh("the account menu leads to settings", async ({ page }) => {
  fresh.slow()
  await signUpOn(page, "/")

  const menu = page.getByRole("button", { name: /Ana Tester/ })
  await expect(menu).toContainText("Free")
  await menu.click()
  await expect(page.getByRole("menuitem", { name: /Billing/ })).toBeDisabled()
  await page.getByRole("menuitem", { name: "Settings" }).click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible()
  await expect(page.getByText("This device", { exact: true })).toBeVisible()
})

fresh("settings need an account", async ({ page }) => {
  await open(page, "/settings")

  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fsettings/)
})

fresh("a new name shows in the sidebar", async ({ page }) => {
  fresh.slow()
  await signUpOn(page, "/settings")

  await page.getByLabel("Name").fill("Ana María")
  await page.getByRole("button", { name: "Save name" }).click()

  await expect(page.getByText("Saved.")).toBeVisible()
  await expect(page.getByRole("button", { name: /Ana María/ })).toBeVisible()
})

fresh("changing the password, then signing in with it", async ({ page }) => {
  fresh.slow()
  const email = await signUpOn(page, "/settings")

  await page.getByLabel("Current password").fill(password)
  await page.getByLabel("New password").fill(newPassword)
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("Password changed.")).toBeVisible()

  await page.getByRole("button", { name: /Ana Tester/ }).click()
  const reload = page.waitForEvent("framenavigated")
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await reload
  await open(page, "/sign-in")
  await signIn(page, email, newPassword)
})

fresh(
  "forgot password: the emailed link sets a new one",
  async ({ page, context }) => {
    fresh.slow()
    fresh.skip(
      Boolean(process.env.PREVIEW_URL),
      "Reads the reset token from the local dev database"
    )
    const email = await signUpOn(page, "/")
    await context.clearCookies()

    await open(page, "/sign-in")
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Reset your password" })
    ).toBeVisible()
    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Email me a link" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Check your inbox" })
    ).toBeVisible()

    await open(page, `/reset-password?token=${await resetToken(email)}`)
    await page.getByLabel("New password").fill(newPassword)
    await page.getByRole("button", { name: "Save password" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Your password is changed" })
    ).toBeVisible()

    await page.getByRole("link", { name: "Sign in" }).click()
    await page.waitForURL(/\/sign-in/)
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
    await signIn(page, email, newPassword)
  }
)

fresh("a reset link works once", async ({ page }) => {
  await open(page, "/reset-password?token=not-a-real-token")

  await page.getByLabel("New password").fill(newPassword)
  await page.getByRole("button", { name: "Save password" }).click()

  await expect(
    page.getByText("This link has expired or was already used.", {
      exact: false,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Ask for a new link" })
  ).toBeVisible()
})

fresh(
  "changing the email asks the new address to confirm",
  async ({ page }) => {
    fresh.slow()
    await signUpOn(page, "/settings")
    const newEmail = `e2e-${crypto.randomUUID()}@example.test`

    await page.getByLabel("New email").fill(newEmail)
    await page.getByRole("button", { name: "Change email" }).click()

    // A new account's email isn't confirmed yet: the link goes straight to
    // the new address (a confirmed one approves first: Worker tests).
    await expect(
      page.getByText(`Check ${newEmail}: open the link to confirm it.`)
    ).toBeVisible()
  }
)

fresh("signing out another device", async ({ page, browser, baseURL }) => {
  fresh.slow()
  const email = await signUpOn(page, "/")

  // The same account on a phone.
  const phone = await browser.newContext({
    baseURL,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  })
  const origin = new URL(page.url()).origin
  await authPost(phone.request, origin, "/sign-in/email", { email, password })

  await open(page, "/settings")
  const other = page
    .getByRole("listitem")
    .filter({ hasText: "Safari on iPhone" })
  await other.getByRole("button", { name: "Sign out" }).click()
  await expect(other).toHaveCount(0)
  await expect(page.getByText("This device", { exact: true })).toBeVisible()

  // Asked past the 5-minute cookie cache, the phone has no session now.
  const session = await phone.request.get(
    "/api/auth/get-session?disableCookieCache=true"
  )
  expect(await session.json()).toBeNull()
  await phone.close()
})

fresh("deleting the account signs out and removes it", async ({ page }) => {
  fresh.slow()
  const email = await signUpOn(page, "/settings")

  await page.getByRole("button", { name: "Delete account" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("Delete your account?")
  await dialog.getByLabel("Your password").fill(password)
  await dialog.getByRole("button", { name: "Delete account" }).click()

  await page.waitForURL("/")
  await expect(
    page.getByRole("link", { name: "Sign in to save" })
  ).toBeVisible()
  await open(page, "/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: /^Sign in/ }).click()
  await expect(
    page.getByText("That email and password don’t match.")
  ).toBeVisible()
})
