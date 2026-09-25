import {
  test as base,
  type Browser,
  type Page,
  type WorkerInfo,
} from "@playwright/test"

/** Opens a page and waits until React handles it (html[data-hydrated]). */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
}

/**
 * A browser context signed in through `path` (an auth endpoint), saved to a
 * file. Sign-ins and sign-ups are rate limited per IP, so it waits and tries
 * again on 429.
 */
async function signedInState(
  browser: Browser,
  workerInfo: Pick<WorkerInfo, "project" | "workerIndex">,
  { name, path, data }: { name: string; path: string; data: object }
) {
  const baseURL = workerInfo.project.use.baseURL ?? ""
  const context = await browser.newContext({ baseURL })
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await context.request.post(path, {
      headers: {
        origin: new URL(baseURL).origin,
        // What Cloudflare's "always passes" test widget answers (the dev
        // server and Previews use its test keys).
        "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
      },
      data,
    })
    if (response.ok()) break
    if (response.status() !== 429 || attempt === 5)
      throw new Error(`${name} sign-in failed: ${response.status()}`)
    const wait = Number(response.headers()["x-retry-after"] ?? 1)
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
  }
  const file =
    workerInfo.project.outputDir + `/${name}-${workerInfo.workerIndex}.json`
  await context.storageState({ path: file })
  await context.close()
  return file
}

/**
 * `test` with a new signed-in guest for each test: a guest keeps one draft
 * (T27), and a fresh one can't see what an earlier test left. Tests of the
 * first visit use the plain `test` from Playwright.
 */
export const test = base.extend<{ guestState: string }>({
  guestState: async ({ browser }, use, testInfo) => {
    await use(
      await signedInState(browser, testInfo, {
        name: `guest-${crypto.randomUUID()}`,
        path: "/api/auth/sign-in/anonymous",
        data: {},
      })
    )
  },
  storageState: ({ guestState }, use) => use(guestState),
})

/**
 * `test` with a signed-up account per worker (email not confirmed). The
 * address is on example.test, so no email is sent.
 */
export const accountTest = base.extend<object, { accountState: string }>({
  accountState: [
    async ({ browser }, use, workerInfo) => {
      await use(
        await signedInState(browser, workerInfo, {
          name: "account",
          path: "/api/auth/sign-up/email",
          data: {
            name: "Ana Tester",
            email: `e2e-${crypto.randomUUID()}@example.test`,
            password: "correct horse 1",
          },
        })
      )
    },
    { scope: "worker" },
  ],
  storageState: ({ accountState }, use) => use(accountState),
})

export { expect } from "@playwright/test"
