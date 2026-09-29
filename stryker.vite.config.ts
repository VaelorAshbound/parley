import { defineConfig, type TestProjectInlineConfiguration } from "vite-plus"

import base from "./vite.config.ts"

// The tests Stryker runs against each mutant (stryker.config.mjs): the Node
// projects of vite.config.ts that test the mutated code, as they are there.
// Stryker's Vitest runner has no browser mode and runs on Node threads, so
// the browser and workerd tests can't kill mutants here.
// https://stryker-mutator.io/docs/stryker-js/vitest-runner/#limitations
const mutationProjects = ["documents", "db", "web"]

const projects = (base.test?.projects ?? []).filter(
  (project): project is TestProjectInlineConfiguration =>
    typeof project === "object" &&
    "test" in project &&
    mutationProjects.includes(project.test?.name as string)
)

export default defineConfig({
  test: {
    projects: projects.map((project) => ({
      ...project,
      // Type tests don't run code, so they kill no mutants.
      test: { ...project.test, typecheck: { enabled: false } },
    })),
  },
})
