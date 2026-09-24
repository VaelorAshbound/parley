import { defineConfig, devices } from "@playwright/test"

// PREVIEW_URL points the suite at a deployed Worker Preview (CI). Without it,
// Playwright starts the local dev server.
const previewUrl = process.env.PREVIEW_URL
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: previewUrl ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A local Chromium when Playwright's own download isn't available.
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(previewUrl
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: "http://localhost:3000/api/health",
          reuseExistingServer: !isCI,
        },
      }),
})
