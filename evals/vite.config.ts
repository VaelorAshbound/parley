import { defineConfig } from "vite-plus"

// The AI evals (spec §6): real conversations with the real model, through
// the real chat procedure, tools, engine and a migrated Postgres. Only
// `pnpm evals` runs them; they cost a few cents on the test key.
export default defineConfig({
  test: {
    include: ["**/*.eval.ts"],
    globalSetup: ["./setup.ts"],
    // A conversation takes several model calls; the cases run side by side.
    testTimeout: 5 * 60_000,
    sequence: { concurrent: true },
  },
})
