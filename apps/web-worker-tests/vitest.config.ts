import { createRequire } from "node:module"

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
        },
      },
    })),
  ],
  test: {
    globalSetup: ["./test/setup.ts"],
    exclude: ["**/node_modules/**", "**/*.real.test.ts"],
  },
})
