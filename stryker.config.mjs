// Mutation testing (spec §6): Stryker changes the code in small ways (a `<`
// for a `<=`, a removed condition, an emptied string) and runs the tests
// against each change. A change no test notices is a "surviving mutant": code
// the tests run but don't check. `pnpm test:mutation` fails under 85%.
// https://stryker-mutator.io/docs/stryker-js/configuration
import { fileURLToPath } from "node:url"

export default {
  testRunner: "vitest",
  // By path: under pnpm, Stryker can't find its plugins by name on its own.
  plugins: [
    fileURLToPath(import.meta.resolve("@stryker-mutator/vitest-runner")),
  ],
  vitest: { configFile: "stryker.vite.config.ts" },
  mutate: [
    // The document engine.
    "packages/documents/src/**/*.ts",
    // The quota: the rules, and the counts in the database.
    "apps/web/src/server/quota.ts",
    "apps/web/src/lib/limits.ts",
    "packages/db/src/queries/exports.ts",
    "packages/db/src/queries/usage.ts",
    // Auth: the procedures' checks run in workerd, so they are mutated by
    // stryker.workers.config.mjs.
  ],
  // Only the files the runs need go into Stryker's copy of the repo.
  ignorePatterns: [
    "/work",
    "/docs",
    "/.claude",
    "/.github",
    "**/coverage",
    "**/dist",
    "**/.wrangler",
    "**/.tanstack",
    "**/.output",
    "**/test-results",
    "**/playwright-report",
    "apps/web/test/real/baselines",
    "reports",
  ],
  // The laptop has 16 GB and the nightly runner 2 cores: one Vitest (and one
  // Postgres for the db tests) per worker.
  concurrency: 2,
  // A static mutant changes code that runs when a module loads (most of all
  // the 12 document definitions, which are data): each one reruns every
  // test, and they are 5,545 of 6,665 mutants, about 98% of the time (over
  // 10 hours). They are reported as ignored, not counted. The definitions'
  // data is checked byte for byte by the snapshot tests instead.
  // https://stryker-mutator.io/docs/mutation-testing-elements/static-mutants/
  ignoreStatic: true,
  thresholds: { high: 90, low: 85, break: 85 },
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
}
