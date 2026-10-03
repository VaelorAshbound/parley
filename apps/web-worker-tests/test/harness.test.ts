import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { openAppClients } from "./db-clients"
import { database, post } from "./helpers"

// The test harness itself: a call's database client must not outlive its
// test, or a run fills the test Postgres (53300) and the machine's memory.

describe("the app's database clients in the tests", () => {
  let backends: (number | null)[] = []

  it("are open during the test that made the call", async () => {
    await post("/api/auth/sign-in/email", {
      email: "nobody@example.com",
      password: "not the password",
    })

    backends = openAppClients()
    expect(backends.length).toBeGreaterThan(0)
  })

  it("are closed once that test is over", async () => {
    const db = await database()
    const { rows } = await db.execute<{ pid: number }>(
      sql`select pid from pg_stat_activity`
    )
    const stillOpen = rows.filter((row) => backends.includes(row.pid))

    expect(openAppClients()).toEqual([])
    expect(stillOpen).toEqual([])
  })
})
