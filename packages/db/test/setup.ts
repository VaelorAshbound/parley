import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { join } from "node:path"
import { createInterface } from "node:readline"

import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { TestProject } from "vite-plus/test/node"

import { connect } from "../src/client.ts"

// A real Postgres 18 for the whole run (the same major as Neon), started from
// npm binaries: no Docker and no root, so it also runs in Workers Builds. It
// runs in a child process (see test/postgres.ts for why). Each test then
// works inside a transaction that rolls back (test/db.ts).

export const migrationsFolder = join(import.meta.dirname, "../migrations")

declare module "vite-plus/test" {
  interface ProvidedContext {
    /** The migrated test database. */
    databaseUrl: string
    /** The server's "postgres" database, for tests that make their own. */
    adminUrl: string
  }
}

export default async function setup(project: TestProject) {
  const port = await freePort()
  const server = spawn(
    process.execPath,
    [join(import.meta.dirname, "postgres.ts"), String(port)],
    { stdio: ["ignore", "pipe", "inherit"] }
  )
  const exited = once(server, "exit")
  for await (const line of createInterface({ input: server.stdout })) {
    if (line === "ready") break
  }

  const base = `postgres://postgres:postgres@localhost:${port}`
  const db = await connect(`${base}/parley`)
  await migrate(db, { migrationsFolder })
  await db.$client.end()

  project.provide("databaseUrl", `${base}/parley`)
  project.provide("adminUrl", `${base}/postgres`)

  return async () => {
    server.kill("SIGTERM")
    await exited
  }
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.once("error", reject)
    probe.listen(0, "localhost", () => {
      const address = probe.address()
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No port"))
      )
    })
  })
}
