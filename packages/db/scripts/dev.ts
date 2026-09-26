// `pnpm db:dev`: the local Postgres for `pnpm dev`, the same major version as
// Neon (18). Data lives in packages/db/.data and survives restarts. Hyperdrive's
// localConnectionString in apps/web/wrangler.jsonc points here.
import { existsSync } from "node:fs"
import { join } from "node:path"

import { migrate } from "drizzle-orm/node-postgres/migrator"
import EmbeddedPostgres from "embedded-postgres"

import { connect } from "../src/client.ts"

export const localUrl = "postgres://postgres:postgres@localhost:54320/parley"

const databaseDir = join(import.meta.dirname, "../.data/postgres")
const server = new EmbeddedPostgres({
  databaseDir,
  port: 54320,
  user: "postgres",
  password: "postgres",
  persistent: true,
  onLog: () => {},
})

if (!existsSync(join(databaseDir, "PG_VERSION"))) await server.initialise()
await server.start()
const admin = server.getPgClient()
await admin.connect()
const found = await admin.query(
  "SELECT 1 FROM pg_database WHERE datname = 'parley'"
)
if (found.rowCount === 0) await server.createDatabase("parley")
await admin.end()

const db = await connect(localUrl)
await migrate(db, {
  migrationsFolder: join(import.meta.dirname, "../migrations"),
})
await db.$client.end()
console.log(`Postgres 18 is ready at ${localUrl} (Ctrl+C to stop)`)

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void server.stop().then(() => process.exit(0)))
