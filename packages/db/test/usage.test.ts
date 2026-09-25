import { describe, expect, inject } from "vite-plus/test"
import { eq } from "drizzle-orm"

import { user } from "../src/auth-schema.ts"
import { connect } from "../src/client.ts"
import { addAiUsage, aiUsageOn, claimMessage } from "../src/queries/usage.ts"
import { makeUser, test } from "./db.ts"

// A user's AI use per UTC day (spec §2 Limits, T27): the daily message
// limit and what the model cost.

const day = "2026-09-25"

describe("claimMessage", () => {
  test("counts the day's first message", async ({ db }) => {
    const owner = await makeUser(db)

    expect(await claimMessage(db, { userId: owner.id, day, limit: 20 })).toBe(
      true
    )
    expect((await aiUsageOn(db, { userId: owner.id, day }))?.messages).toBe(1)
  })

  test("takes the last message under the limit, and refuses the next", async ({
    db,
  }) => {
    const owner = await makeUser(db)
    for (let each = 1; each <= 2; each++)
      await claimMessage(db, { userId: owner.id, day, limit: 3 })

    const last = await claimMessage(db, { userId: owner.id, day, limit: 3 })
    const next = await claimMessage(db, { userId: owner.id, day, limit: 3 })

    expect([last, next]).toEqual([true, false])
    expect((await aiUsageOn(db, { userId: owner.id, day }))?.messages).toBe(3)
  })

  test("starts again on a new day", async ({ db }) => {
    const owner = await makeUser(db)
    await claimMessage(db, { userId: owner.id, day, limit: 1 })

    expect(
      await claimMessage(db, { userId: owner.id, day: "2026-09-26", limit: 1 })
    ).toBe(true)
  })

  test("refuses everything when the limit is 0", async ({ db }) => {
    const owner = await makeUser(db)

    expect(await claimMessage(db, { userId: owner.id, day, limit: 0 })).toBe(
      false
    )
    expect(await aiUsageOn(db, { userId: owner.id, day })).toBeUndefined()
  })

  // Two connections, as two requests would have.
  test("two at once can't both take the last message", async () => {
    const setup = await connect(inject("databaseUrl"))
    const first = await connect(inject("databaseUrl"))
    const second = await connect(inject("databaseUrl"))
    const id = `usage-race-${crypto.randomUUID()}`
    try {
      await setup
        .insert(user)
        .values({ id, name: "Race", email: `${id}@example.test` })

      const results = await Promise.all([
        claimMessage(first, { userId: id, day, limit: 1 }),
        claimMessage(second, { userId: id, day, limit: 1 }),
      ])

      expect(results.toSorted()).toEqual([false, true])
    } finally {
      await setup.delete(user).where(eq(user.id, id))
      await Promise.all([setup, first, second].map((db) => db.$client.end()))
    }
  })
})

describe("addAiUsage", () => {
  test("adds a turn's tokens and cost to the day", async ({ db }) => {
    const owner = await makeUser(db)
    await claimMessage(db, { userId: owner.id, day, limit: 20 })
    const turn = { inputTokens: 1200, outputTokens: 300, costMicroUsd: 270 }

    await addAiUsage(db, { userId: owner.id, day, ...turn })
    await addAiUsage(db, { userId: owner.id, day, ...turn })

    expect(await aiUsageOn(db, { userId: owner.id, day })).toMatchObject({
      messages: 1,
      inputTokens: 2400,
      outputTokens: 600,
      costMicroUsd: 540,
    })
  })

  test("makes the day's row when there is none yet", async ({ db }) => {
    const owner = await makeUser(db)

    await addAiUsage(db, {
      userId: owner.id,
      day,
      inputTokens: 10,
      outputTokens: 5,
      costMicroUsd: 20,
    })

    expect(await aiUsageOn(db, { userId: owner.id, day })).toMatchObject({
      messages: 0,
      inputTokens: 10,
    })
  })
})
