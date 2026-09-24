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
