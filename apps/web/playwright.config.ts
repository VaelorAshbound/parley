import { defineConfig, devices } from "@playwright/test"

// PREVIEW_URL points the suite at a deployed Worker Preview (CI). Without it,
// Playwright starts the local dev server.
const previewUrl = process.env.PREVIEW_URL
const isCI = Boolean(process.env.CI)
// PORT matches the dev server's (vite.config.ts), for parallel worktrees.
const localUrl = `http://localhost:${process.env.PORT ?? 3000}`

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // One test at a time locally: the dev server, Postgres and browsers share
  // one laptop (owner's call, 2026-09-28). CI splits the run across machines.
  workers: isCI ? undefined : 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: previewUrl ?? localUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Visual baselines are made in Playwright's own image (CI's container,
  // or `pnpm test:e2e:docker`, which set PW_VISUAL): elsewhere fonts render
  // a little differently, so screenshots aren't compared.
  // https://playwright.dev/docs/test-snapshots
  ignoreSnapshots: !process.env.PW_VISUAL,
  expect: {
    // A Preview answers from Frankfurt, and CI's runners are in the US.
    timeout: 10_000,
    toHaveScreenshot: { animations: "disabled", caret: "hide" },
  },
  // Desktop runs every test but the @phone-only ones; phones run the ones
  // tagged @phone (spec §6: every user story on desktop and a phone, in all
  // three engines).
  projects: [
    {
      name: "chromium",
      grepInvert: /@phone-only/,
      use: {
        ...devices["Desktop Chrome"],
        // A local Chromium when Playwright's own download isn't available.
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
    {
      name: "firefox",
      grepInvert: /@phone-only/,
      use: devices["Desktop Firefox"],
    },
    {
      name: "webkit",
      grepInvert: /@phone-only/,
      use: devices["Desktop Safari"],
    },
    {
      name: "chromium-phone",
      grep: /@phone/,
      use: devices["Pixel 7"],
    },
    // Firefox has no mobile mode in Playwright: a phone-sized touch screen.
    {
      name: "firefox-phone",
      grep: /@phone/,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 393, height: 851 },
        hasTouch: true,
      },
    },
    {
      name: "webkit-phone",
      grep: /@phone/,
      use: devices["iPhone 15"],
    },
  ],
  ...(previewUrl
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: `${localUrl}/api/health`,
          reuseExistingServer: !isCI,
        },
      }),
})
