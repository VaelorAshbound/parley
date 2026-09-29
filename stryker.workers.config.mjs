// Mutation testing of the procedures' auth checks (spec §6): who may call
// what, and whose draft it is (apps/web/src/server/rpc/base.ts). Their tests
// run in workerd (apps/web-worker-tests), which Stryker's Vitest runner can't
// drive (it runs Vitest on Node threads), so each mutant runs those tests as
// a command. Part of `pnpm test:mutation`, after stryker.config.mjs.
// https://stryker-mutator.io/docs/stryker-js/configuration/#commandrunner-object
import base from "./stryker.config.mjs"

export default {
  ignorePatterns: base.ignorePatterns,
  thresholds: base.thresholds,
  reporters: base.reporters,
  testRunner: "command",
  commandRunner: {
    // The auth matrix (every procedure × every kind of caller), the
    // confirmed-email checks, the per-user rate limit and the log fields
    // the auth check adds.
    command:
      "pnpm --dir apps/web-worker-tests exec vitest run test/auth-matrix.test.ts test/verified.test.ts test/limits.test.ts test/observability.test.ts",
  },
  mutate: ["apps/web/src/server/rpc/base.ts"],
  // A command runs every test for every mutant; the tests start workerd and
  // Postgres, so no more than two at a time.
  concurrency: 2,
  // Two runs side by side take longer than the one timed at the start; a
  // mutant is only called a timeout when its run takes 3 times as long.
  timeoutFactor: 3,
  htmlReporter: { fileName: "reports/mutation-workers/index.html" },
  jsonReporter: { fileName: "reports/mutation-workers/mutation.json" },
}
