import type { Page } from "@playwright/test"

import { accountTest, expect, open, test } from "./helpers"

// The draft history (T22): date groups, search, /drafts, and rename,
// duplicate and delete (with undo) from the sidebar and the title menu.

async function startNda(page: Page) {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  return new URL(page.url()).pathname
}

/** The draft's own title button in the chat header. */
function titleMenu(page: Page) {
  return page.getByRole("heading", { level: 1 }).getByRole("button")
}

/** Opens the sidebar if it is a slim rail, and waits for today's drafts. */
async function openSidebar(page: Page) {
  const history = page.getByRole("list", { name: "Today" })
  if (!(await history.isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click()
  await expect(history).toBeVisible()
}

/** Sets a party's company over the API, as the field editor would. */
async function setCompany(page: Page, draftPath: string, company: string) {
  const id = draftPath.split("/").at(-1)
  const response = await page.request.post("/api/rpc/drafts/updateFields", {
    headers: { "x-csrf-token": "orpc" },
    data: { json: { id, changes: [{ key: "party2", value: { company } }] } },
  })
  expect(response.ok()).toBe(true)
}

test("renames a draft from its title menu, everywhere at once", async ({
  page,
}) => {
  const draftPath = await startNda(page)
  const name = `NDA ${crypto.randomUUID().slice(0, 8)}`

  await titleMenu(page).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  const dialog = page.getByRole("dialog", { name: "Rename draft" })
  await dialog.getByLabel("Name").fill(`  ${name}  `)
  await dialog.getByRole("button", { name: "Save" }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
  await openSidebar(page)
  await expect(
    page.getByRole("list", { name: "Today" }).getByRole("link", { name })
  ).toHaveAttribute("href", draftPath)
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
})

test("won't save an empty name", async ({ page }) => {
  await startNda(page)

  await titleMenu(page).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  const dialog = page.getByRole("dialog", { name: "Rename draft" })
  await dialog.getByLabel("Name").fill("   ")
  await dialog.getByRole("button", { name: "Save" }).click()

  await expect(dialog.getByText("Please give the draft a name.")).toBeVisible()
})

test("deletes a draft from the sidebar, with undo", async ({ page }) => {
  // It waits out a 6 s undo window, twice over on a busy machine.
  test.slow()
  const draftPath = await startNda(page)
  await titleMenu(page).click()
  const name = `Delete me ${crypto.randomUUID().slice(0, 8)}`
  await page.getByRole("menuitem", { name: "Rename" }).click()
  const dialog = page.getByRole("dialog", { name: "Rename draft" })
  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Save" }).click()
  await openSidebar(page)
  const row = page.getByRole("link", { name, exact: true })

  // The open draft goes away at once, and Undo brings it back.
  await page.getByRole("button", { name: `More for ${name}` }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(page).toHaveURL("/")
  await expect(row).toBeHidden()
  const toast = page.getByText("Draft deleted")
  await expect(toast).toBeVisible()
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page).toHaveURL(draftPath)
  await expect(row).toBeVisible()

  // Without an undo, the delete happens when the toast closes.
  const deleted = page.waitForResponse(
    (response) => response.url().endsWith("/api/rpc/drafts/delete"),
    { timeout: 15_000 }
  )
  await page.getByRole("button", { name: `More for ${name}` }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  expect((await deleted).ok()).toBe(true)
  await expect(toast).toBeHidden()
  await page.goto(draftPath)
  await expect(
    page.getByText("We couldn’t find that page", { exact: true })
  ).toBeVisible()
})

accountTest(
  "duplicates a draft from its title menu and opens the copy",
  async ({ page }) => {
    const draftPath = await startNda(page)

    await titleMenu(page).click()
    await page.getByRole("menuitem", { name: "Duplicate" }).click()

    await expect(page).not.toHaveURL(draftPath)
    await expect(page).toHaveURL(/\/d\/[0-9a-f-]{36}/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Mutual Non-Disclosure Agreement (copy)"
    )
  }
)

accountTest(
  "finds a draft by a party's name with ⌘K search",
  async ({ page }) => {
    const draftPath = await startNda(page)
    const company = `Zephyr${crypto.randomUUID().slice(0, 6)} Labs`
    await setCompany(page, draftPath, company)
    await page.getByRole("link", { name: "New draft" }).click()
    await expect(page).toHaveURL("/")

    await page.keyboard.press("ControlOrMeta+k")
    const dialog = page.getByRole("dialog", { name: "Search drafts" })
    await dialog.getByRole("combobox").fill(company.slice(0, 8).toLowerCase())
    await expect(
      dialog.getByRole("option", { name: /Mutual Non-Disclosure Agreement/ })
    ).toHaveCount(1)
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(draftPath)
  }
)

accountTest(
  "lists every draft on /drafts, with search and a filter in the URL",
  async ({ page }) => {
    // Two drafts to start, and a wait past the search box's pause.
    test.slow()
    const otherPath = await startNda(page)
    const draftPath = await startNda(page)
    const company = `Quasar${crypto.randomUUID().slice(0, 6)} Labs`
    await setCompany(page, draftPath, company)
    await openSidebar(page)

    await page.getByRole("link", { name: "View all" }).click()
    await expect(page).toHaveURL("/drafts")
    await page.getByLabel("Search drafts").fill(company.slice(0, 9))
    await expect(page).toHaveURL(/[?&]q=/)
    const results = page.getByRole("list", { name: "Drafts" })
    await expect(results.getByRole("listitem")).toHaveCount(1)
    await expect(results.getByRole("link")).toHaveAttribute("href", draftPath)

    await page.getByRole("combobox", { name: "Agreement" }).click()
    await page.getByRole("option", { name: "Pilot Agreement" }).click()
    await expect(page).toHaveURL(/type=pilot-agreement/)
    await expect(page.getByText("No drafts match")).toBeVisible()

    await page.reload()
    await expect(page.getByLabel("Search drafts")).toHaveValue(
      company.slice(0, 9)
    )
    await page.getByRole("link", { name: "Clear the search" }).click()
    // Past the search box's pause: the old search must not come back.
    await page.waitForTimeout(600)
    await expect(page).toHaveURL("/drafts")
    await expect(page.getByLabel("Search drafts")).toHaveValue("")
    await expect(
      results.getByRole("link").and(page.locator(`[href="${otherPath}"]`))
    ).toBeVisible()
  }
)

accountTest(
  "keeps what you type on /drafts while the last search loads",
  async ({ page }) => {
    // Holds the request for "acme" until more has been typed.
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    let onHeld = () => {}
    const requested = new Promise<void>((resolve) => (onHeld = resolve))
    await page.route("**/api/rpc/drafts/list", async (route) => {
      const body = route.request().postData() ?? ""
      if (body.includes('"acme"')) {
        onHeld()
        await held
      }
      await route.continue()
    })
    await open(page, "/drafts")
    const box = page.getByLabel("Search drafts")

    await box.pressSequentially("acme")
    await requested
    // Longer than the router waits before it shows a loading page.
    await page.waitForTimeout(1_200)
    await expect(box).toBeVisible()
    await box.pressSequentially(" bol")
    release()

    await expect(page).toHaveURL(/[?&]q=acme(\+|%20)bol/)
    await expect(box).toHaveValue("acme bol")
  }
)

test("a guest is sent to sign in from /drafts, and back after", async ({
  page,
}) => {
  await page.goto("/drafts?q=acme")

  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(
    "/drafts?q=acme"
  )
})
