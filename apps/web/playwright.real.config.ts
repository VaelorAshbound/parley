import { defineConfig, devices } from "@playwright/test"

// `pnpm test:real` (T33, spec §6 "Real-service tests"): the paid and sandbox
// services, for real, on every PR against the Preview and its own Neon
// branch. A whole Mutual NDA drafted by the real model and downloaded as a
// PDF, a Polar sandbox checkout, the confirmation email through Resend, and
// Turnstile, plus the post-deploy smoke test (e2e/smoke.prod.spec.ts).
// No scripted AI here: the tests never set its cookie.
// PREVIEW_URL is the target (CI); without it, the local dev server.
const previewUrl = process.env.PREVIEW_URL
const isCI = Boolean(process.env.CI)
const localUrl = `http://localhost:${process.env.PORT ?? 3000}`

export default defineConfig({
  testDir: "./e2e",
  // The real-service specs, and the post-deploy smoke test (its PR run).
  testMatch: ["real/*.real.ts", "smoke.prod.spec.ts"],
  // One at a time: each spends money or a sandbox's quota, and a failure
  // should be read, not retried into a second charge.
  workers: 1,
  retries: 0,
  forbidOnly: isCI,
  // A real chat turn takes seconds; a whole NDA takes a few of them.
  timeout: 5 * 60_000,
  reporter: isCI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report-real" }],
        ["json", { outputFile: "test-results/real.json" }],
      ]
    : [["list"]],
  outputDir: "test-results/real",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: previewUrl ?? localUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  expect: { timeout: 15_000 },
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
