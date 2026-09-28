import { resolve } from "node:path"

import { defineConfig } from "vite-plus"
import { playwright } from "vite-plus/test/browser-playwright"

// `pnpm test:real` (T31): all 12 documents exported for real and checked.
// print.ts makes the files in Node (real Browser Run for the PDFs); the test
// reads them back in a real Chromium, where pdf.js draws each PDF page and
// Vitest's toMatchScreenshot compares it with the approved baseline in
// baselines/. Accept new baselines with `pnpm test:real --update`, after
// looking at them.
// https://vitest.dev/guide/browser/visual-regression-testing
export default defineConfig({
  test: {
    name: "real",
    root: import.meta.dirname,
    include: ["**/*.real.test.ts"],
    testTimeout: 60_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      }),
      // A whole US Letter page fits, so a page is one screenshot.
      viewport: { width: 700, height: 850 },
      // print.ts is set on the instance: on the project, Vitest runs it for
      // the project and again for its browser instance (two prints each).
      instances: [{ browser: "chromium", globalSetup: ["print.ts"] }],
      expect: {
        toMatchScreenshot: {
          // pdf.js draws the same file the same way in the same browser, so
          // any changed pixel is the PDF's. No pixels allowed: at 0.1% a
          // missing "2.6 Subprocessors." line passed (T31). The color
          // threshold only absorbs anti-aliasing.
          comparatorName: "pixelmatch",
          comparatorOptions: { threshold: 0.1, allowedMismatchedPixelRatio: 0 },
          resolveScreenshotPath: ({ arg, ext, root, browserName, platform }) =>
            resolve(
              root,
              "baselines",
              `${arg}-${browserName}-${platform}${ext}`
            ),
          resolveDiffPath: ({ arg, ext, root, browserName, platform }) =>
            resolve(
              root,
              "output/diffs",
              `${arg}-${browserName}-${platform}${ext}`
            ),
        },
      },
    },
  },
})
