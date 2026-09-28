import { test, type Page } from "@playwright/test"

import { totp } from "../src/test/totp"
import { expect, open } from "./helpers"

// Two-factor sign-in (T23b), in a real browser against the dev server: turn
// it on in Settings, sign out, sign in with a code the test makes from the
// QR code's key (as an authenticator app would), use a backup code once,
// and turn it off. The address is on example.test, so no email is sent.

// Sign-ins allow 3 tries per 10 s per IP, and so does each two-factor
// step: one at a time.
test.describe.configure({ mode: "serial" })

const password = "correct horse 1"

/** Cloudflare's dummy Turnstile token: the dev server uses the test keys. */
const captcha = { "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX" }

/** A new account, signed in on this page, made through the API. */
async function signUp(page: Page) {
  await open(page, "/sign-in")
  const email = `e2e-${crypto.randomUUID()}@example.test`
  const origin = new URL(page.url()).origin
  for (let attempt = 1; ; attempt++) {
    const response = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin, ...captcha },
      data: { name: "Ana Tester", email, password },
    })
    if (response.ok()) return email
    if (response.status() !== 429 || attempt === 5)
      throw new Error(`Sign-up failed: ${response.status()}`)
    const wait = Number(response.headers()["x-retry-after"] ?? 1)
    await page.waitForTimeout(wait * 1000)
  }
}

/**
 * Presses a button until `done` happens, pressing again after a wait when
 * the IP hit the limit (3 tries per 10 s, shared with the other browser).
 */
async function submitUntil(
  page: Page,
  press: () => Promise<void>,
  done: () => Promise<unknown>
) {
  const limited = page.getByText("Too many tries", { exact: false })
  for (let attempt = 1; ; attempt++) {
    await press()
    // The last try's message goes away when the form sends again.
    if (attempt > 1) await limited.waitFor({ state: "hidden" })
    const outcome = await Promise.race([
      done().then(() => "done" as const),
      limited.waitFor().then(() => "limited" as const),
    ])
    if (outcome === "done" || attempt === 4) return
    await page.waitForTimeout(10_000)
  }
}

/**
 * The password step of signing in, from a signed-out browser. It goes back
 * to Settings after, a page that stays put once loaded.
 */
async function signInWithPassword(page: Page, email: string) {
  await page.context().clearCookies()
  await open(page, "/sign-in?redirect=%2Fsettings")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await submitUntil(
    page,
    () => page.getByRole("button", { name: /^Sign in/ }).click(),
    () => page.waitForURL((url) => !/sign-in/.test(url.pathname))
  )
}

/**
 * Types a code into the code boxes (a full code is sent at once) until
 * `done` happens: by default, the page leaves the code step.
 */
async function enterCode(
  page: Page,
  label: string,
  code: string,
  done = () => page.waitForURL((url) => !/two-factor/.test(url.pathname))
) {
  const boxes = page.getByLabel(label)
  await submitUntil(
    page,
    async () => {
      // Filling in the same code again is no change: empty the boxes first.
      await boxes.fill("")
      await boxes.fill(code)
    },
    done
  )
}

/** Signed in, on Settings, and the page is interactive. */
async function signedIn(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible()
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
}

test("two-factor sign-in: on, a code, a backup code once, off", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const email = await signUp(page)
  await open(page, "/settings")
  const card = page.getByRole("heading", { name: "Two-factor sign-in" })
  await expect(card).toBeVisible()

  // Turn on: the password, then the first code from the app.
  await page.getByRole("button", { name: "Turn on", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Your password").fill(password)
  await dialog.getByRole("button", { name: "Continue" }).click()
  await expect(
    dialog.getByRole("img", { name: "QR code for your authenticator app" })
  ).toBeVisible()
  const key = (await dialog.locator("code").innerText()).replaceAll(" ", "")
  const app = `otpauth://totp/Parley?secret=${key}`
  const on = dialog.getByRole("heading", { name: "Two-factor sign-in is on" })
  await enterCode(page, "6-digit code", await totp(app), () => on.waitFor())

  // On, with 10 backup codes shown once.
  await expect(on).toBeVisible()
  const backupCodes = await dialog
    .getByRole("list", { name: "Backup codes" })
    .getByRole("listitem")
    .allInnerTexts()
  expect(backupCodes).toHaveLength(10)
  await expect(dialog.getByRole("button", { name: "Download" })).toBeVisible()
  // Shown once: Escape or a click beside the dialog can't lose them.
  await page.keyboard.press("Escape")
  await page.mouse.click(5, 5)
  await expect(on).toBeVisible()
  await dialog.getByRole("button", { name: "Done" }).click()
  await expect(page.getByText("On", { exact: true })).toBeVisible()

  // Sign out; the password alone isn't enough now.
  await signInWithPassword(page, email)
  await expect(page).toHaveURL(/\/two-factor/)
  await enterCode(page, "6-digit code", await totp(app))
  await signedIn(page)

  // A backup code signs in once.
  const [backup = ""] = backupCodes
  await signInWithPassword(page, email)
  await page.getByRole("button", { name: "Use a backup code instead" }).click()
  await enterCode(page, "Backup code", backup.replace("-", ""))
  await signedIn(page)

  await signInWithPassword(page, email)
  await page.getByRole("button", { name: "Use a backup code instead" }).click()
  const used = page.getByText(
    "That backup code isn’t right, or it was used already."
  )
  await enterCode(page, "Backup code", backup.replace("-", ""), () =>
    used.waitFor()
  )
  await expect(used).toBeVisible()
  await page
    .getByRole("button", { name: "Use your authenticator app instead" })
    .click()
  await enterCode(page, "6-digit code", await totp(app))
  await signedIn(page)

  // Turn off: the password alone signs in again.
  await page.getByRole("button", { name: "Turn off" }).click()
  await dialog.getByLabel("Your password").fill(password)
  await dialog.getByRole("button", { name: "Turn off" }).click()
  await expect(
    page.getByRole("button", { name: "Turn on", exact: true })
  ).toBeVisible()
  await signInWithPassword(page, email)
  await signedIn(page)
})

test("the code step without a password first", async ({ page }) => {
  await open(page, "/two-factor")

  await page.getByLabel("6-digit code").fill("000000")

  // No sign-in waiting for a code in this browser: back to the password.
  await expect(
    page.getByText("Your sign-in timed out. Please sign in again.")
  ).toBeVisible()
  await expect(
    page.getByRole("alert").getByRole("link", { name: "Sign in" })
  ).toBeVisible()
})
