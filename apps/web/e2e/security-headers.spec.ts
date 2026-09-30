import type { Page } from "@playwright/test"

import { draftOpened, expect, fresh, open } from "./helpers"

// The pages' security headers (T38, src/server/headers.ts). The CSP runs
// only scripts with the response's nonce, so one that Start or a library
// adds without it would break the page quietly: every page here must load
// and work with no violation at all.

/** Every CSP violation the page reports, across navigations. */
async function watchViolations(page: Page) {
  const violations: string[] = []
  await page.exposeFunction("reportCspViolation", (text: string) => {
    violations.push(text)
  })
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (
        window as unknown as { reportCspViolation: (text: string) => void }
      ).reportCspViolation
      report(`${event.effectiveDirective} blocked ${event.blockedURI}`)
    })
  })
  return violations
}

fresh("a visitor starts a draft with no CSP violation", async ({ page }) => {
  const violations = await watchViolations(page)
  await open(page, "/")
  // Turnstile's script and frame come from challenges.cloudflare.com. Its
  // iframe sits in a closed shadow root, so a locator can't see it.
  await expect
    .poll(() =>
      page
        .frames()
        .some((frame) =>
          frame.url().startsWith("https://challenges.cloudflare.com/")
        )
    )
    .toBe(true)

  await page
    .getByRole("textbox", { name: "Describe your deal" })
    .fill("We're sharing our product roadmap with a vendor and need an NDA.")
  await page.keyboard.press("Enter")
  await draftOpened(page)
  await expect(
    page.getByRole("region", { name: "Live document" }).getByRole("heading", {
      level: 2,
    })
  ).toBeVisible()

  for (const path of ["/pricing", "/sign-in", "/no-such-page"]) {
    await open(page, path)
  }
  expect(violations).toEqual([])
})

fresh("a page response carries the security headers", async ({ page }) => {
  const response = await page.goto("/")
  const headers = response?.headers() ?? {}
  const nonce = await page
    .locator('meta[property="csp-nonce"]')
    .getAttribute("content")

  expect(nonce).toBeTruthy()
  expect(headers["content-security-policy"]).toContain(`'nonce-${nonce}'`)
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'")
  expect(headers).toMatchObject({
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  })
})
