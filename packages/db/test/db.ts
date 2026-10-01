import { TransactionRollbackError } from "drizzle-orm"
import { test as base, inject } from "vite-plus/test"

import { connect, type Db } from "../src/client.ts"
import { user } from "../src/auth-schema.ts"

/**
 * `db` is a transaction that rolls back after the test, so tests can't see
 * each other's rows and need no cleanup.
 */
export const test = base.extend<{ db: Db }>({
  // oxlint-disable-next-line no-empty-pattern -- Vitest reads fixture names from the pattern.
  db: async ({}, use) => {
    const db = await connect(inject("databaseUrl"))
    try {
      await db.transaction(async (tx) => {
        await use(tx)
        tx.rollback()
      })
    } catch (error) {
      if (!(error instanceof TransactionRollbackError)) throw error
    } finally {
      await db.$client.end()
    }
  },
})

let users = 0

/** A user row, as Better Auth would make it. */
export async function makeUser(db: Db, fields: { isAnonymous?: boolean } = {}) {
  users += 1
  const [row] = await db
    .insert(user)
    .values({
      id: `user-${users}`,
      name: `User ${users}`,
      email: `user-${users}@example.test`,
      ...fields,
    })
    .returning()
  if (!row) throw new Error("No user row")
  return row
}
