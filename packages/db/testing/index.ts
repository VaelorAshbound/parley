import { spawn } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:net"
import { join } from "node:path"
import { createInterface } from "node:readline"

import { migrate } from "drizzle-orm/node-postgres/migrator"

import { connect } from "../src/client.ts"

// A real, migrated Postgres 18 for a test run (ADR-0004). The server runs in a
// child process; see postgres.ts for why.

export const migrationsFolder = join(import.meta.dirname, "../migrations")

export async function startTestDatabase() {
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

  return {
    /** The migrated database. */
    url: `${base}/parley`,
    /** The server's "postgres" database, for tests that make their own. */
    adminUrl: `${base}/postgres`,
    async stop() {
      server.kill("SIGTERM")
      await exited
    },
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
