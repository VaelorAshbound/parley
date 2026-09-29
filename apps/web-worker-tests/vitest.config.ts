import { createRequire } from "node:module"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// pg is CommonJS. Inside the workerd module runner its require() calls get
// the wrong package build: pg-protocol's "import" build (ESM in .js files,
// which fails) and pg-cloudflare's non-workerd stub (empty). Point both at
// the CommonJS build wrangler's bundler picks for the real Worker. Tests only.
const fromPg = createRequire(
  createRequire(import.meta.resolve("@workspace/db")).resolve("pg")
)
const pgProtocol = fromPg.resolve("pg-protocol")
const pgCloudflare = fromPg
  .resolve("pg-cloudflare/package.json")
  .replace(/package\.json$/, "dist/index.js")

// The web app (a workspace dependency of this package).
const web = dirname(fileURLToPath(import.meta.resolve("web/package.json")))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^pg-protocol$/, replacement: pgProtocol },
      { find: /^pg-cloudflare$/, replacement: pgCloudflare },
    ],
  },
  plugins: [
    cloudflareTest(({ inject }) => ({
      // Same compatibility settings and bindings as the real Worker.
      wrangler: { configPath: "../web/wrangler.jsonc" },
      // The Hono app, not src/server.ts: the Start server entry is a Vite
      // virtual module that only the TanStack Start plugin can resolve.
      main: "../web/src/server/api.ts",
      // Offline by default: no Cloudflare login needed, nothing billed.
      remoteBindings: false,
      miniflare: {
        // Hyperdrive goes straight to the test database from test/setup.ts.
        hyperdrives: { HYPERDRIVE: inject("databaseUrl") },
        bindings: {
          BETTER_AUTH_SECRET: "test-only-secret-that-is-long-enough-0123456789",
          // Never used: the chat tests pass a scripted model (helpers.ts).
          OPENROUTER_API_KEY: "test-only-no-real-calls",
          // Never reaches Resend: the email tests fake fetch (resend.ts).
          RESEND_API_KEY: "re_test_only_no_real_sends",
          // Cloudflare's "always passes" test secret; siteverify is faked
          // anyway (test/siteverify.ts).
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          // OAuth apps that don't exist: the tests fake GitHub's endpoints.
          GITHUB_CLIENT_ID: "test-github-client",
          GITHUB_CLIENT_SECRET: "test-github-secret",
          GOOGLE_CLIENT_ID: "test-google-client",
          GOOGLE_CLIENT_SECRET: "test-google-secret",
          // Polar: the tests fake its API (test/polar.ts) and sign their
          // own webhooks with this secret.
          POLAR_ACCESS_TOKEN: "polar_oat_test_only_no_real_calls",
          // A Standard Webhooks secret, as Polar makes them since
          // 2026-09-08 (test/polar.ts signs with its base64 key).
          POLAR_WEBHOOK_SECRET:
            "whsec_dGVzdCBvbmx5OiBub3QgYSByZWFsIHNlY3JldCBrZXk=",
        },
      },
    })),
  ],
  test: {
    globalSetup: ["./test/setup.ts"],
    setupFiles: ["./test/siteverify.ts"],
    exclude: ["**/node_modules/**", "**/*.real.test.ts"],
    // Istanbul: workerd has no V8 coverage (Cloudflare's known issues,
    // https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#coverage).
    // Only in `pnpm test:coverage`; the gate for the server code (spec §6).
    coverage: {
      provider: "istanbul",
      allowExternal: true,
      include: [`${web}/src/server/**`],
      exclude: ["**/*.test.{ts,tsx}", "**/*.test-d.ts"],
      reporter: ["text-summary", "json"],
    },
    projects: [
      { extends: true, test: { name: "workers" } },
      // Runs no tests. Vitest 4.1 reports the files no test loaded only when
      // they sit inside some project's root, and the server code is outside
      // this one; without it a file nobody tests would not count as missed.
      { root: web, test: { name: "web-files", include: [] } },
    ],
  },
})
