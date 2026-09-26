import type { TestProject } from "vite-plus/test/node"

import { startTestDatabase } from "../testing/index.ts"

// One real Postgres 18 for the whole run (ADR-0004). Each test then works
// inside a transaction that rolls back (test/db.ts).

declare module "vite-plus/test" {
  interface ProvidedContext {
    /** The migrated test database. */
    databaseUrl: string
    /** The server's "postgres" database, for tests that make their own. */
    adminUrl: string
  }
}

export default async function setup(project: TestProject) {
  const database = await startTestDatabase()
  project.provide("databaseUrl", database.url)
  project.provide("adminUrl", database.adminUrl)
  return () => database.stop()
}
