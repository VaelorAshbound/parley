import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type TestProjectInlineConfiguration } from "vite-plus"
import { playwright } from "vite-plus/test/browser-playwright"

// Component tests in a real browser (spec §6): Vitest browser mode with the
// Playwright provider. T32 adds Firefox and WebKit.
const browserProject = {
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), react()],
  test: {
    name: "web-browser",
    root: "apps/web",
    include: ["src/**/*.browser.test.tsx"],
    // The app's real styles, so tests see what people see.
    setupFiles: ["src/test/browser-setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          // A local Chromium when Playwright's download isn't available.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      }),
      instances: [{ browser: "chromium" }],
    },
  },
} satisfies TestProjectInlineConfiguration

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "import"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      ".claude/worktrees/",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
    ],
    overrides: [
      {
        files: ["apps/web/**", "packages/ui/**"],
        plugins: ["react", "jsx-a11y"],
        rules: {
          // A module-level store would be shared by every request an isolate
          // serves (spec §5 Zustand rules); use createStore in a provider.
          "no-restricted-imports": [
            "error",
            {
              paths: [
                {
                  name: "zustand",
                  importNames: ["create", "default"],
                  message:
                    "Use createStore in a provider (src/lib/ui-store.tsx).",
                },
              ],
            },
          ],
        },
      },
      {
        // Components the shadcn CLI writes are kept as it writes them, so an
        // update shows only upstream's changes. Their roles and label
        // wiring follow Base UI's patterns, which these rules don't know.
        files: ["packages/ui/src/components/**"],
        plugins: ["react", "jsx-a11y"],
        rules: {
          "jsx-a11y/prefer-tag-over-role": "off",
          "jsx-a11y/click-events-have-key-events": "off",
          "jsx-a11y/no-noninteractive-element-interactions": "off",
          "jsx-a11y/label-has-associated-control": "off",
        },
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
        rules: {
          // A `test` made with test.extend (fixtures, e.g. the DB tests'
          // rollback in packages/db/test/db.ts) isn't traced back to Vitest.
          "vitest/no-standalone-expect": [
            "warn",
            { additionalTestBlockFunctions: ["test"] },
          ],
        },
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
      // Agent worktrees are whole checkouts of the repo; each lints itself.
      ".claude/worktrees/",
      "CLAUDE.md",
      "work/",
      "templates/",
      "catalog.json",
      "pnpm-lock.yaml",
      "**/routeTree.gen.ts",
      "**/worker-configuration.d.ts",
      "packages/documents/generated/",
      // Written by drizzle-kit and the Better Auth CLI; kept exactly as made,
      // so a re-run shows only real changes.
      "packages/db/migrations/",
      "packages/db/src/auth-schema.ts",
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
      include: ["packages/documents/src/**", "packages/db/src/**"],
      // Generated by the Better Auth CLI (pnpm db:auth-schema).
      exclude: ["packages/db/src/auth-schema.ts"],
      // spec §6: the document engine is fully covered. T34 adds the rest.
      thresholds: {
        "packages/documents/src/**": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        // spec §6. The Better Auth tables are generated, not written here.
        "packages/db/src/**": { lines: 95, branches: 90 },
      },
    },
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "web",
          root: "apps/web",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.tsx"],
          typecheck: {
            enabled: true,
            include: ["src/**/*.test-d.ts"],
            tsconfig: "./tsconfig.json",
          },
        },
      },
      // Workers Builds (WORKERS_CI=1) has no browsers, so the browser tests run
      // on GitHub Actions (ADR-0001). Left out here, not with `--project`: any
      // --project filter makes v8 coverage report no files (Vitest 5.0.1).
      ...(process.env.WORKERS_CI === "1" ? [] : [browserProject]),
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
          name: "db",
          root: "packages/db",
          include: ["test/**/*.test.ts"],
          // One real Postgres for the run; each test rolls back (test/db.ts).
          globalSetup: ["test/setup.ts"],
          fileParallelism: false,
        },
      },
      {
        // The evals' scoring only; the evals themselves run with `pnpm evals`.
        test: {
          name: "evals",
          root: "evals",
          include: ["**/*.test.ts"],
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
