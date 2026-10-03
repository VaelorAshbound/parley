import { cloudflare } from "@cloudflare/vite-plugin"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, lazyPlugins } from "vite-plus"

import { signedInToCloudflare } from "./dev/cloudflare-login.ts"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Port 3000: the Google and GitHub dev OAuth apps redirect here. PORT lets
  // parallel worktrees run their own server (OAuth only works on 3000).
  server: { port: Number(process.env.PORT ?? 3000), strictPort: true },
  plugins: lazyPlugins(() => [
    // https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // PDF export uses the real Browser Run (ADR-0010).
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
