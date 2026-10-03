import { describe, expect } from "vite-plus/test"

import {
  polarCustomerOf,
  setPlan,
  userOfPolarCustomer,
} from "../src/queries/billing.ts"
import { makeUser, test } from "./db.ts"

// The plan Polar's webhooks set (spec §2 Limits, T26). Polar may send a
// state twice, or late and out of order; the newest state must win.

const monday = new Date("2026-09-28T10:00:00.000Z")
const tuesday = new Date("2026-09-29T10:00:00.000Z")

describe("setPlan", () => {
  test("turns Pro on for a free user", async ({ db }) => {
    const owner = await makeUser(db)

    const result = await setPlan(db, {
      userId: owner.id,
      plan: "pro",
      at: monday,
    })

    expect(result).toEqual({ userId: owner.id, plan: "pro", applied: true })
  })

  test("applies the same state twice with the same result", async ({ db }) => {
    const owner = await makeUser(db)
    await setPlan(db, { userId: owner.id, plan: "pro", at: monday })

    const again = await setPlan(db, {
      userId: owner.id,
      plan: "pro",
      at: monday,
    })

    expect(again).toEqual({ userId: owner.id, plan: "pro", applied: true })
  })

  test("ignores a state older than the one it has", async ({ db }) => {
    const owner = await makeUser(db)
    await setPlan(db, { userId: owner.id, plan: "free", at: tuesday })

    const late = await setPlan(db, {
      userId: owner.id,
      plan: "pro",
      at: monday,
    })

    expect(late).toEqual({ userId: owner.id, plan: "free", applied: false })
  })

  test("takes a newer state", async ({ db }) => {
    const owner = await makeUser(db)
    await setPlan(db, { userId: owner.id, plan: "pro", at: monday })

    const newer = await setPlan(db, {
      userId: owner.id,
      plan: "free",
      at: tuesday,
    })

    expect(newer).toEqual({ userId: owner.id, plan: "free", applied: true })
  })

  test("says so when there is no such user", async ({ db }) => {
    expect(
      await setPlan(db, { userId: "nobody", plan: "pro", at: monday })
    ).toBeUndefined()
  })

  test("keeps the Polar customer it came from", async ({ db }) => {
    const owner = await makeUser(db)

    await setPlan(db, {
      userId: owner.id,
      plan: "pro",
      at: monday,
      customerId: "polar-customer-1",
    })

    expect(await userOfPolarCustomer(db, "polar-customer-1")).toBe(owner.id)
  })
})

describe("userOfPolarCustomer", () => {
  test("is undefined for a customer Parley never saw", async ({ db }) => {
    expect(await userOfPolarCustomer(db, "polar-customer-x")).toBeUndefined()
  })
})

describe("polarCustomerOf", () => {
  test("is undefined for someone who never bought", async ({ db }) => {
    const owner = await makeUser(db)

    expect(await polarCustomerOf(db, owner.id)).toBeUndefined()
  })

  test("is the customer id from Polar's last state", async ({ db }) => {
    const owner = await makeUser(db)
    await setPlan(db, {
      userId: owner.id,
      plan: "free",
      at: monday,
      customerId: "polar-customer-2",
    })

    expect(await polarCustomerOf(db, owner.id)).toBe("polar-customer-2")
  })
})
