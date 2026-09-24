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
      ".output/",
      ".tanstack/",
      ".wrangler/",
      "coverage/",
      "dist/",
    ],
  },
  test: {
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
          name: "ui",
          root: "packages/ui",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
})
