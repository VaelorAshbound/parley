import { drizzle, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import type { PgDatabase } from "drizzle-orm/pg-core"
import { Client } from "pg"

import * as authSchema from "./auth-schema.ts"
import * as appSchema from "./schema.ts"

export const schema = { ...authSchema, ...appSchema }
export type Schema = typeof schema

/** The database or a transaction: every query takes either. */
export type Db = PgDatabase<NodePgQueryResultHKT, Schema>

/**
 * A new client for one request. On Workers the connection string comes from
 * Hyperdrive, which keeps the real pool, so a client per request is cheap and
 * nothing is shared between requests.
 * https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/
 */
export async function connect(connectionString: string) {
  const client = new Client({ connectionString })
  await client.connect()
  return drizzle({ client, schema })
}
