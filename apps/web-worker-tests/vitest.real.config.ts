import { createRequire } from "node:module"

import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// pg's CommonJS builds, as in vitest.config.ts: billing.ts (the real Polar
// test) imports @workspace/db, which brings pg in. No query runs here.
const fromPg = createRequire(
  createRequire(import.meta.resolve("@workspace/db")).resolve("pg")
)
const pgProtocol = fromPg.resolve("pg-protocol")
const pgCloudflare = fromPg
  .resolve("pg-cloudflare/package.json")
  .replace(/package\.json$/, "dist/index.js")

// Real-service Worker tests: remote bindings (Browser Run) on the owner's
// Cloudflare account. Needs `wrangler login` or CLOUDFLARE_API_TOKEN.
// Polar's sandbox token comes from apps/web/.dev.vars.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^pg-protocol$/, replacement: pgProtocol },
      { find: /^pg-cloudflare$/, replacement: pgCloudflare },
    ],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "../web/wrangler.jsonc" },
      main: "../web/src/server/api.ts",
      remoteBindings: true,
      // Resend's key from the shell (never a file here): without it the
      // real email test is skipped.
      miniflare: {
        bindings: { RESEND_API_KEY: process.env.RESEND_API_KEY ?? "" },
      },
    }),
  ],
  test: {
    include: ["test/**/*.real.test.ts"],
  },
})
