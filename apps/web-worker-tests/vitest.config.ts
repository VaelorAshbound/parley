import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      // Same compatibility settings and bindings as the real Worker.
      wrangler: { configPath: "../web/wrangler.jsonc" },
      // The Hono app, not src/server.ts: the Start server entry is a Vite
      // virtual module that only the TanStack Start plugin can resolve.
      main: "../web/src/server/api.ts",
      // Offline by default: no Cloudflare login needed, nothing billed.
      remoteBindings: false,
    }),
  ],
  test: {
    exclude: ["**/node_modules/**", "**/*.real.test.ts"],
  },
})
