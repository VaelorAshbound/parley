import { startTestDatabase } from "@workspace/db/testing"
import type { TestProject } from "vitest/node"

// A real, migrated Postgres 18 for the run (ADR-0004). Hyperdrive in workerd
// points at it (vitest.config.ts).

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const database = await startTestDatabase()
  project.provide("databaseUrl", database.url)
  return () => database.stop()
}
