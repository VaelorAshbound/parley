import { test as base, type Page } from "@playwright/test"

/** Opens a page and waits until React handles it (html[data-hydrated]). */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
}

/**
 * `test` with a signed-in guest per worker. Sign-ins are rate limited per IP
 * (3 per 10 s), so tests share one guest per worker instead of each making
 * their own. Tests of the first visit use the plain `test` from Playwright.
 */
export const test = base.extend<object, { guestState: string }>({
  guestState: [
    async ({ browser }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? ""
      const context = await browser.newContext({ baseURL })
      for (let attempt = 1; attempt <= 5; attempt++) {
        const response = await context.request.post(
          "/api/auth/sign-in/anonymous",
          { headers: { origin: new URL(baseURL).origin }, data: {} }
        )
        if (response.ok()) break
        if (response.status() !== 429 || attempt === 5)
          throw new Error(`Guest sign-in failed: ${response.status()}`)
        const wait = Number(response.headers()["x-retry-after"] ?? 1)
        await new Promise((resolve) => setTimeout(resolve, wait * 1000))
      }
      const path =
        workerInfo.project.outputDir + `/guest-${workerInfo.workerIndex}.json`
      await context.storageState({ path })
      await context.close()
      await use(path)
    },
    { scope: "worker" },
  ],
  storageState: ({ guestState }, use) => use(guestState),
})

export { expect } from "@playwright/test"
