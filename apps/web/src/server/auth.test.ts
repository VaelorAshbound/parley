import { schema } from "@workspace/db"
import { getSchema } from "better-auth/db"
import { getTableColumns, is } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vite-plus/test"

import { allowedHosts, createAuth } from "./auth"

const auth = createAuth({
  db: drizzle.mock({ schema }),
  env: { BETTER_AUTH_SECRET: "x".repeat(32), STAGE: "production" } as Env,
  waitUntil: () => {},
})

describe("the auth config", () => {
  // packages/db/src/auth-schema.ts is generated from a CLI config
  // (pnpm db:auth-schema); this proves the real config needs nothing more.
  it("finds every table and column it needs in the database schema", () => {
    const tables: Record<string, unknown> = schema

    for (const [model, { fields }] of Object.entries(getSchema(auth.options))) {
      const table = tables[model]
      expect(is(table, PgTable), `table ${model}`).toBe(true)
      const columns = Object.keys(getTableColumns(table as PgTable))
      for (const field of ["id", ...Object.keys(fields)])
        expect(columns, `${model}.${field}`).toContain(field)
    }
  })

  it("serves production on its own domain only, never on workers.dev", () => {
    expect(allowedHosts("production")).toEqual([
      "parley.runtimedrift.dev",
      "localhost:*",
    ])
  })

  it("serves previews on workers.dev", () => {
    expect(allowedHosts("preview")).toEqual([
      "*-parley.vaelorashbound.workers.dev",
      "localhost:*",
    ])
  })
})
