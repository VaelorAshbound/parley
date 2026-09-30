import { draftOpened, expect, fresh, open, test } from "./helpers"

// Accessible names and targets that T36's QA found rough (PAR-41): names
// that run words together, an unrounded separator value, a 20 px button,
// and two Toggle Sidebar buttons side by side.

fresh(
  "the start page's headings and composer read cleanly",
  async ({ page }) => {
    await open(page, "/")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Describe the deal. Watch the contract fill itself in.",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Eleven agreements. One conversation.",
        exact: true,
      })
    ).toBeVisible()
    // The composer's hint, which named its group "Enterto start…".
    await expect(
      page.getByText("Enter to start", { exact: true })
    ).toBeVisible()
    // The hint is for the eye; the button carries the shortcut.
    await expect(
      page.getByRole("button", { name: "Start drafting", exact: true })
    ).toHaveAttribute("aria-keyshortcuts", "Enter")
  }
)

fresh(
  "the start page's names read cleanly in Chromium's accessibility tree",
  async ({ page, browserName }) => {
    // What a screen reader gets (and T36's snapshot saw): Chromium's own
    // tree, which Playwright's role queries don't use.
    test.skip(browserName !== "chromium", "Chromium's accessibility tree")
    await open(page, "/")

    const cdp = await page.context().newCDPSession(page)
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
      nodes: { role?: { value?: string }; name?: { value?: string } }[]
    }
    const named = (role: string) =>
      nodes
        .filter((node) => node.role?.value === role)
        .map((node) => node.name?.value ?? "")
    expect(named("heading")).toContain(
      "Describe the deal. Watch the contract fill itself in."
    )
    expect(named("heading")).toContain("Eleven agreements. One conversation.")
    // The composer's group: no name, or just its button's, never the hint
    // run into the button ("Enterto startStart drafting").
    const composer = named("group").filter((name) => /enter|start/i.test(name))
    expect(composer).toEqual(composer.map(() => "Start drafting"))
  }
)

fresh(
  "the sign-in button is named Sign in, with Last used as its description",
  async ({ page, baseURL }) => {
    await page.context().addCookies([
      {
        name: "better-auth.last_used_login_method",
        value: "email",
        url: baseURL ?? "",
      },
    ])
    await open(page, "/sign-in")

    const button = page.getByRole("button", { name: "Sign in", exact: true })
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleDescription("Last used")
  }
)

test("the draft page's separator, More button and sidebar toggle", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("button", { name: /Mutual NDA/ }).click()
  await draftOpened(page)

  // The separator's value is a whole percent.
  const separator = page.locator('[data-slot="resizable-handle"]')
  await separator.focus()
  // Until it stops at the chat's minimum width, a fraction of the page.
  for (let press = 0; press < 30; press++)
    await page.keyboard.press("ArrowLeft")
  await expect(separator).toHaveAttribute("aria-valuenow", /^\d+$/)
  await expect(separator).toHaveAttribute("aria-valuemin", /^\d+$/)
  await expect(separator).toHaveAttribute("aria-valuemax", /^\d+$/)

  // The sidebar's More button is at least 24 px (WCAG 2.5.8). With a draft,
  // the sidebar opens on the next load.
  await page.reload()
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
  const more = page.getByRole("button", { name: /^More for / }).first()
  await more.hover()
  const box = await more.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(24)
  expect(box?.height).toBeGreaterThanOrEqual(24)

  // One Toggle Sidebar, not the rail beside the real button.
  await expect(
    page.getByRole("button", { name: "Toggle Sidebar" })
  ).toHaveCount(1)
})
