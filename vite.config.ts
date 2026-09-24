import { defineConfig } from "vite-plus"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "import"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["**/routeTree.gen.ts", "**/worker-configuration.d.ts"],
    overrides: [
      {
        files: ["apps/web/**", "packages/ui/**"],
        plugins: ["react", "jsx-a11y"],
      },
      {
        // Worker tests stay on Vitest 4.1 until @cloudflare/vitest-plugin supports
        // Vitest 5 (PAR-2), so they import from "vitest", not "vite-plus/test".
        files: ["apps/web-worker-tests/**"],
        plugins: ["vitest"],
        rules: { "vite-plus/prefer-vite-plus-imports": "off" },
      },
      {
        files: ["**/*.test.{ts,tsx}", "**/*.test-d.ts"],
        plugins: ["vitest"],
      },
      {
        // Schemas must be built after z.config({ jitless: true }) runs.
        files: ["packages/documents/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: [
                {
                  name: "zod",
                  message: 'Import { z } from "src/zod.ts" (jitless).',
                },
              ],
            },
          ],
        },
      },
      {
        files: ["packages/documents/src/zod.ts"],
        rules: { "no-restricted-imports": "off" },
      },
    ],
  },
  fmt: {
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: "packages/ui/src/styles/globals.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: [
      "CLAUDE.md",
      "work/",
      "templates/",
      "catalog.json",
      "pnpm-lock.yaml",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
      "packages/documents/generated/",
      // Byte-exact test snapshots; formatting them would break the match.
      "**/__outputs__/",
      "**/__outlines__/",
      ".output/",
      ".tanstack/",
      ".wrangler/",
      "coverage/",
      "dist/",
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/documents/src/**"],
      // spec §6: the document engine is fully covered. T34 adds the rest.
      thresholds: {
        "packages/documents/src/**": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "web",
          root: "apps/web",
          include: ["src/**/*.test.{ts,tsx}"],
          typecheck: {
            enabled: true,
            include: ["src/**/*.test-d.ts"],
            tsconfig: "./tsconfig.json",
          },
        },
      },
      {
        test: {
          name: "documents",
          root: "packages/documents",
          include: ["test/**/*.test.ts"],
          typecheck: {
            enabled: true,
            include: ["test/**/*.test-d.ts"],
            tsconfig: "./tsconfig.json",
          },
          // Pure functions with no shared state: one module graph is faster,
          // and CI runs with --shuffle to prove the order does not matter.
          isolate: false,
        },
      },
      {
        test: {
          name: "ui",
          root: "packages/ui",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
})
