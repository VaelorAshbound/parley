import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// Real-service Worker tests: remote bindings (Browser Run) on the owner's
// Cloudflare account. Needs `wrangler login` or CLOUDFLARE_API_TOKEN.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "../web/wrangler.jsonc" },
      main: "../web/src/server/api.ts",
      remoteBindings: true,
    }),
  ],
  test: {
    include: ["test/**/*.real.test.ts"],
  },
})
