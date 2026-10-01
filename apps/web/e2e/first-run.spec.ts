import { DISCLAIMER } from "@workspace/documents"

import { draftOpened, expect, fresh, open, test } from "./helpers"

// First run (T37): the start page as a visitor sees it, and the phone
// document's bottom bar with Share and Download (brand.md canvas).

test("the start page credits Common Paper and says it's a demo", async ({
  page,
}) => {
  await open(page, "/")

  await expect(page.getByText(DISCLAIMER)).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Common Paper" }).first()
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "Examples" }).getByRole("button")
  ).toHaveCount(4)
  // The footer is outside <main>, so it is the page's contentinfo (PAR-22).
  await expect(page.getByRole("contentinfo")).toBeVisible()
})

test("the start page fits a phone, with no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/")

  await expect(
    page.getByRole("heading", { level: 1, name: /Describe the deal/ })
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})

fresh(
  "a first visit stays at the top of the page on a phone",
  async ({ page }) => {
    // A visitor (no guest yet) has the Turnstile box under the examples, and
    // it scrolled itself into view as the page hydrated (Checkpoint 6 review).
    await page.setViewportSize({ width: 375, height: 667 })
    await open(page, "/")
    // The jump came with hydration; two frames later it had happened.
    const scrollY = await page.evaluate(
      () =>
        new Promise<number>((done) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => done(window.scrollY))
          )
        )
    )

    expect(scrollY).toBe(0)
  }
)

test("“Start drafting, free” takes you to the reply box", async ({ page }) => {
  await open(page, "/")

  await page.getByRole("button", { name: "Start drafting, free" }).click()

  await expect(
    page.getByRole("textbox", { name: "Describe your deal" })
  ).toBeFocused()
})

test("the start page doesn't shift while it loads", async ({
  page,
  browserName,
}) => {
  // Only Chromium reports layout shifts; elsewhere this would pass for
  // nothing.
  test.skip(browserName !== "chromium", "layout-shift is Chromium only")
  // Wide enough for the art at full size.
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, "/")
  const shift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            total += (entry as PerformanceEntry & { value: number }).value
        }).observe({ type: "layout-shift", buffered: true })
        // The reveal's movement ends at about 4 s.
        setTimeout(() => resolve(total), 4500)
      })
  )

  // Same bar as the draft page (shell.spec.ts): only the font swap may move
  // text, a little.
  expect(shift).toBeLessThanOrEqual(0.02)
})

test("with reduced motion, the start page fades in place", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, "/")

  // No sweep: the headline's highlight fades in, as color only.
  await expect(page.locator(".hero-marker")).toHaveCSS(
    "animation-name",
    "ink-fade"
  )
  // Nothing slides: the art has no transform once it has faded in.
  await expect(page.locator(".hero-rise").first()).toHaveCSS("opacity", "1")
  await expect(page.locator(".hero-rise").first()).toHaveCSS(
    "transform",
    "none"
  )
  // Still in order: the change marker fades in after Purpose's ink (PAR-22).
  await expect(page.locator(".hero-pop").last()).toHaveCSS(
    "animation-delay",
    "2.3s"
  )
})

test("when a start from the library fails, the note is on screen", async ({
  page,
}) => {
  await page.route("**/api/rpc/drafts/create", (route) =>
    route.fulfill({ status: 500, body: "" })
  )
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/")

  const agreement = page.getByRole("button", {
    name: /Business Associate Agreement/,
  })
  await agreement.click()

  await expect(page.getByRole("alert")).toBeInViewport()
  // Keyboard focus is still where it was, not lost to the page (PAR-22).
  await expect(agreement).toBeFocused()
})

test("on a phone, Share and Download sit in a bar under the document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)
  await page.getByRole("button", { name: "Document" }).click()

  const bar = page.getByRole("group", { name: "Share or download" })
  await expect(bar).toBeVisible()
  // One of each on screen: the header's pair is for wider screens.
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(1)
  const box = await bar.boundingBox()
  expect(box && box.y + box.height).toBeGreaterThan(812 - 40)

  await bar.getByRole("button", { name: "Download" }).click()
  await expect(page.getByRole("menuitem", { name: "PDF" })).toBeVisible()
})

test("on a wide screen, Share and Download stay in the header", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Mutual Non-Disclosure Agreement",
    })
  ).toBeVisible()

  await expect(
    page.getByRole("group", { name: "Share or download" })
  ).toBeHidden()
  await expect(
    page
      .getByRole("region", { name: "Live document" })
      .getByRole("button", { name: "Download" })
  ).toBeVisible()
})
