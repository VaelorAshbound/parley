// Types for the browser-mode tests: the custom commands in the root
// vite.config.ts.
export {}

declare module "vite-plus/test/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>
  }
}
