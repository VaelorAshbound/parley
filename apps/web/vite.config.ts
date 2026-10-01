import { cloudflare } from "@cloudflare/vite-plugin"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { defineConfig, lazyPlugins } from "vite-plus"

/**
 * Browser Run (PDF export) has no local simulator, so dev uses the real one
 * (ADR-0010), which needs a Cloudflare login: an API token, or
 * `wrangler login`. A fresh clone has neither and runs without remote
 * bindings: everything works except the PDF.
 */
function signedInToCloudflare() {
  if (process.env.CLOUDFLARE_API_TOKEN) return true
  const config = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  if (existsSync(join(config, ".wrangler/config/default.toml"))) return true
  console.warn(
    "No Cloudflare login: PDF export is off. Run `pnpm exec wrangler login` to turn it on."
  )
  return false
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Port 3000: the Google and GitHub dev OAuth apps redirect here. PORT lets
  // parallel worktrees run their own server (OAuth only works on 3000).
  server: { port: Number(process.env.PORT ?? 3000), strictPort: true },
  plugins: lazyPlugins(() => [
    // https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
    cloudflare({
      viteEnvironment: { name: "ssr" },
      remoteBindings: signedInToCloudflare(),
      // The Worker debugger's port (9229) is shared too: a second dev server
      // on its own PORT runs without one.
      ...(process.env.PORT && { inspectorPort: false as const }),
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    // The stable Babel React Compiler; plugin-react's Rust `compiler` option is
    // still experimental. https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#react-compiler
    babel({ presets: [reactCompilerPreset()] }),
  ]),
})
