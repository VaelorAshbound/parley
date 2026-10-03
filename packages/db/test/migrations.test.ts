import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { getTableName, is } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"
import { Client } from "pg"
import { expect, inject, test } from "vite-plus/test"

import { connect, schema } from "../src/client.ts"
import { migrationsFolder } from "../testing/index.ts"

test("the migrations build every table on an empty database", async () => {
  const admin = new Client({ connectionString: inject("adminUrl") })
  await admin.connect()
  const name = `migrations_${process.pid}`
  await admin.query(`CREATE DATABASE ${name}`)
  const db = await connect(
    inject("adminUrl").replace(/\/postgres$/, `/${name}`)
  )
  try {
    await migrate(db, { migrationsFolder })

    const tables = await db.$client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      Object.values(schema)
        .filter((each) => is(each, PgTable))
        .map((table) => getTableName(table))
        .toSorted()
    )
    // Every index the schema declares exists after all migrations (0001
    // changes the search column in place, which keeps its GIN index).
    const indexes = await db.$client.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
    )
    const declared = Object.values(schema)
      .filter((each) => is(each, PgTable))
      .flatMap((table) => getTableConfig(table).indexes)
      .map((index) => index.config.name)
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining(declared)
    )
  } finally {
    await db.$client.end()
    await admin.query(`DROP DATABASE ${name}`)
    await admin.end()
  }
})

test("every foreign key cascades, so deleting a user deletes all their data", () => {
  const foreignKeys = Object.values(schema)
    .filter((each) => is(each, PgTable))
    .flatMap((table) => getTableConfig(table).foreignKeys)

  expect(foreignKeys.length).toBeGreaterThan(0)
  for (const foreignKey of foreignKeys) {
    const { foreignTable } = foreignKey.reference()
    expect(
      foreignKey.onDelete,
      `${getTableName(foreignTable)} ← ${foreignKey.getName()}`
    ).toBe("cascade")
  }
})

test("the purge indexes (0005) build on a database that already has sessions and rate limits", async () => {
  // The migrations up to 0004 only, as production had them before PAR-14.
  const before = mkdtempSync(join(tmpdir(), "parley-migrations-"))
  cpSync(migrationsFolder, before, { recursive: true })
  const journalPath = join(before, "meta/_journal.json")
  const journal: { entries: { tag: string }[] } = JSON.parse(
    readFileSync(journalPath, "utf8")
  )
  const at = journal.entries.findIndex((entry) => entry.tag.startsWith("0005"))
  expect(at).toBe(5)
  journal.entries = journal.entries.slice(0, at)
  writeFileSync(journalPath, JSON.stringify(journal))

  const admin = new Client({ connectionString: inject("adminUrl") })
  await admin.connect()
  const name = `migrations_data_${process.pid}`
  await admin.query(`CREATE DATABASE ${name}`)
  const db = await connect(
    inject("adminUrl").replace(/\/postgres$/, `/${name}`)
  )
  try {
    await migrate(db, { migrationsFolder: before })
    // Rows as Better Auth writes them, with repeated times: a plain index
    // takes duplicates (a unique one would fail here).
    await db.$client.query(
      `INSERT INTO "user" (id, name, email) VALUES ('u1', 'Ana', 'ana@example.test')`
    )
    await db.$client.query(
      `INSERT INTO session (id, token, user_id, updated_at, expires_at)
       SELECT 's' || n, 't' || n, 'u1', now(), timestamp '2026-03-20' + (n % 3) * interval '1 day'
       FROM generate_series(1, 1000) AS n`
    )
    await db.$client.query(
      `INSERT INTO rate_limit (id, key, count, last_request)
       SELECT 'r' || n, 'k' || n, 1, 1773890220000 + (n % 3)
       FROM generate_series(1, 1000) AS n`
    )

    await migrate(db, { migrationsFolder })

    const indexes = await db.$client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE indexname IN ('session_expiresAt_idx', 'rateLimit_lastRequest_idx') ORDER BY indexname`
    )
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      "rateLimit_lastRequest_idx",
      "session_expiresAt_idx",
    ])
    const counts = await db.$client.query<{ sessions: string; limits: string }>(
      `SELECT (SELECT count(*) FROM session) AS sessions, (SELECT count(*) FROM rate_limit) AS limits`
    )
    expect(counts.rows[0]).toEqual({ sessions: "1000", limits: "1000" })
  } finally {
    await db.$client.end()
    await admin.query(`DROP DATABASE ${name}`)
    await admin.end()
    rmSync(before, { recursive: true, force: true })
  }
})
