import AxeBuilder from "@axe-core/playwright"
import {
  expect,
  test as base,
  type Browser,
  type Page,
  type WorkerInfo,
} from "@playwright/test"
import { connect, schema, type Db } from "@workspace/db"
import { eq } from "drizzle-orm"

/** Opens a page and waits until React handles it (html[data-hydrated]). */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" })
}

/**
 * Waits until a draft that was just started or opened is on screen. The URL
 * changes before the draft page's code has loaded, and a page.goto made in
 * between is aborted by Firefox (NS_BINDING_ABORTED) and WebKit ("interrupted
 * by another navigation"): the PAR-8 flakes.
 */
export async function draftOpened(page: Page) {
  await page.waitForURL(/\/d\/[0-9a-f-]{36}/)
  await page.getByRole("region", { name: "Chat" }).waitFor()
}

/** Tries at a 429 before a sign-in gives up. */
const attempts = 10

/**
 * A browser context signed in through `path` (an auth endpoint), saved to a
 * file. Sign-ins and sign-ups are rate limited per IP (a Preview lets 5 new
 * guests in per 10 s), so it waits as long as the server says and tries
 * again on 429.
 */
async function signedInState(
  browser: Browser,
  workerInfo: Pick<WorkerInfo, "project" | "workerIndex">,
  { name, path, data }: { name: string; path: string; data: object }
) {
  const baseURL = workerInfo.project.use.baseURL ?? ""
  const context = await browser.newContext({ baseURL })
  for (let attempt = 1; attempt <= attempts; attempt++) {
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
    if (response.status() !== 429 || attempt === attempts)
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
 * Playwright's `test` for a first visit (no session), whose browser chats
 * with the scripted AI (src/server/ai/scripted-model.ts): fast, the same
 * every run, and free. Previews and local dev honor the cookie; production
 * ignores it.
 */
export const fresh = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.addCookies([
      { name: "parley-scripted-ai", value: "1", url: baseURL ?? "" },
    ])
    await use(context)
  },
})

/**
 * `test` with a new signed-in guest for each test: a guest keeps one draft
 * (T27), and a fresh one can't see what an earlier test left. Tests of the
 * first visit use the plain `test` from Playwright.
 */
export const test = fresh.extend<{ guestState: string }>({
  guestState: [
    async ({ browser }, use, testInfo) => {
      await use(
        await signedInState(browser, testInfo, {
          name: `guest-${crypto.randomUUID()}`,
          path: "/api/auth/sign-in/anonymous",
          data: {},
        })
      )
    },
    // Waiting for a new guest doesn't use up the test's own time.
    { timeout: 60_000 },
  ],
  storageState: ({ guestState }, use) => use(guestState),
})

/**
 * `test` with a signed-up account per worker (email not confirmed). The
 * address is on example.test, so no email is sent.
 */
export const accountTest = fresh.extend<object, { accountState: string }>({
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

/**
 * The database the app under test serves from. CI sets E2E_DATABASE_URL to
 * the Preview's own Neon branch (T33, e2e.yml); local dev uses `pnpm
 * db:dev`'s. Undefined against a Preview when CI has no Neon access: the
 * tests that need it skip.
 */
export const databaseUrl =
  process.env.E2E_DATABASE_URL ||
  (process.env.PREVIEW_URL
    ? undefined
    : "postgres://postgres:postgres@localhost:54320/parley")

/** Runs `use` on the app's database (see databaseUrl). */
export async function withDatabase<T>(use: (db: Db) => Promise<T>) {
  if (!databaseUrl) throw new Error("No database for this run")
  const db = await connect(databaseUrl)
  try {
    return await use(db)
  } finally {
    await db.$client.end()
  }
}

/**
 * Marks the account's email as confirmed, as its emailed link would. The
 * link is signed with the server's secret, which CI doesn't have for a
 * Preview; the database is the Preview's own branch, so this touches no one
 * else's data. The session cookie keeps the old value for up to 5 minutes
 * (cookieCache): sign in again after this.
 */
export async function confirmEmail(email: string) {
  await withDatabase((db) =>
    db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.email, email))
  )
}

/**
 * Checks the page with axe for WCAG 2.2 A and AA (spec §6: zero serious or
 * critical violations on every page and state). Lists each one it finds.
 * https://playwright.dev/docs/accessibility-testing
 */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The start page's picture of a draft: text in a picture has no
    // contrast minimum (WCAG 1.4.3, "Incidental"), and screen readers skip it.
    .exclude("[data-slot=hero-art]")
    .analyze()
  const serious = violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, help, nodes }) => ({
      id,
      help,
      targets: nodes.map(({ target }) => target.join(" ")),
    }))
  expect(serious).toEqual([])
  // One main landmark, so "skip to main" lands in one place (axe calls a
  // second one only "moderate").
  await expect(page.getByRole("main")).toHaveCount(1)
}

export { expect }
