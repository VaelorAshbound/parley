import { test, type Page } from "@playwright/test"

import {
  confirmedAccount,
  databaseUrl,
  draftOpened,
  expect,
  open,
} from "./helpers"

// Share links (T25): the owner copies a read-only link, a visitor with no
// account opens it, the owner turns it off, and the link gives a friendly
// 404. Sharing needs a confirmed email, so the owner's email is confirmed
// in the app's database: local dev's, or the Preview's own Neon branch in
// CI (T33).

/**
 * The X-Robots-Tag a share page answers with. On a workers.dev Preview,
 * Cloudflare puts its own `noindex` in place of the app's header (seen on
 * the first Preview run, T33; https://developers.cloudflare.com/workers/previews/#urls);
 * the page's robots meta tag still says nofollow.
 */
function robotsHeader(baseURL: string | undefined) {
  return new URL(baseURL ?? "").hostname.endsWith(".workers.dev")
    ? "noindex"
    : "noindex, nofollow"
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
  test.skip(!databaseUrl, "Needs the Preview's database (E2E_DATABASE_URL)")
  // Several pages, each compiled on first use by the dev server.
  test.slow()
  const { context, email } = await confirmedAccount(browser, baseURL ?? "")
  const page = await context.newPage()
  if (browserName === "chromium")
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)
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
    "x-robots-tag": robotsHeader(baseURL),
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
    "x-robots-tag": robotsHeader(baseURL),
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
  // A real title, not the bare app name (PAR-36).
  await expect(page).toHaveTitle("Link not found · Parley")
})
