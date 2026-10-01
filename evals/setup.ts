import { startTestDatabase } from "@workspace/db/testing"
import type { TestProject } from "vite-plus/test/node"

// A real, migrated Postgres 18 for the run, like the Worker tests (ADR-0004).

declare module "vite-plus/test" {
  interface ProvidedContext {
    databaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const database = await startTestDatabase()
  project.provide("databaseUrl", database.url)
  return () => database.stop()
}
