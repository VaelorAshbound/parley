import {
  connect,
  deleteExpiredSessions,
  deleteExpiredVerifications,
  deleteIdleGuests,
  deleteOldRateLimits,
  type Db,
} from "@workspace/db"
import { Temporal } from "temporal-polyfill"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import {
  inBatches,
  purgeOldData,
  RATE_LIMIT_KEEP_HOURS,
  scheduled,
} from "./cron"

// The deletes are faked here, so a run can fail halfway on purpose. The
// Worker tests (apps/web-worker-tests/test/cron.test.ts) run them for real.
vi.mock(import("@workspace/db"), async (original) => ({
  ...(await original()),
  connect: vi.fn<typeof connect>(),
  deleteIdleGuests: vi.fn<typeof deleteIdleGuests>(),
  deleteExpiredSessions: vi.fn<typeof deleteExpiredSessions>(),
  deleteExpiredVerifications: vi.fn<typeof deleteExpiredVerifications>(),
  deleteOldRateLimits: vi.fn<typeof deleteOldRateLimits>(),
}))

beforeEach(() => {
  vi.mocked(deleteIdleGuests).mockReset().mockResolvedValue(0)
  vi.mocked(deleteExpiredSessions).mockReset().mockResolvedValue(0)
  vi.mocked(deleteExpiredVerifications).mockReset().mockResolvedValue(0)
  vi.mocked(deleteOldRateLimits).mockReset().mockResolvedValue(0)
})

/** A table with `rows` rows to delete; each call deletes up to its limit. */
function table(rows: number) {
  const limits: number[] = []
  let left = rows
  const deleteBatch = async (limit: number) => {
    limits.push(limit)
    const count = Math.min(limit, left)
    left -= count
    return count
  }
  return { deleteBatch, limits }
}

describe("inBatches", () => {
  it("stops after the first batch that comes back short", async () => {
    const { deleteBatch, limits } = table(5)

    const complete = await inBatches(deleteBatch, { size: 2, max: 10 })

    expect(complete).toBe(true)
    expect(limits).toEqual([2, 2, 2])
  })

  it("asks once more after a full batch, to see that nothing is left", async () => {
    const { deleteBatch, limits } = table(4)

    const complete = await inBatches(deleteBatch, { size: 2, max: 10 })

    expect(complete).toBe(true)
    expect(limits).toHaveLength(3)
  })

  it("stops at the cap and says there is more for the next run", async () => {
    const { deleteBatch, limits } = table(100)

    const complete = await inBatches(deleteBatch, { size: 2, max: 3 })

    expect(complete).toBe(false)
    expect(limits).toHaveLength(3)
  })

  it("deletes 500 rows a batch and 20 batches a run by default", async () => {
    const { deleteBatch, limits } = table(20_000)

    const complete = await inBatches(deleteBatch)

    expect(complete).toBe(false)
    expect(limits).toHaveLength(20)
    expect(new Set(limits)).toEqual(new Set([500]))
  })
})

describe("scheduled", () => {
  it("logs what a failed run deleted before it failed", async () => {
    // Deletes can't be undone: on-call must see how much went.
    // All scheduled() does with the connection itself is close it.
    const connection = { $client: { end: async () => {} } }
    vi.mocked(connect).mockResolvedValue(
      connection as unknown as Awaited<ReturnType<typeof connect>>
    )
    vi.mocked(deleteIdleGuests)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(3)
    vi.mocked(deleteExpiredSessions)
      .mockResolvedValueOnce(500)
      .mockRejectedValueOnce(
        Object.assign(new Error("terminating connection"), { code: "57P01" })
      )
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = {
      cron: "17 3 * * *",
      scheduledTime: Date.UTC(2026, 2, 20, 3, 17),
      noRetry: () => {},
    }
    const env = { HYPERDRIVE: { connectionString: "postgres://faked" } }

    await expect(
      scheduled(controller, env as Env, {} as ExecutionContext)
    ).rejects.toThrow("terminating connection")

    expect(error.mock.calls).toEqual([
      [
        expect.objectContaining({
          event: "purge_failed",
          guests: 503,
          sessions: 500,
          error: expect.objectContaining({ code: "57P01" }),
        }),
      ],
    ])
  })
})

describe("purgeOldData", () => {
  const now = Temporal.Instant.from("2026-03-20T03:17:00Z")
  const db = {} as Db
  const nothingYet = () => ({
    guests: 0,
    sessions: 0,
    verifications: 0,
    rateLimits: 0,
  })

  it("deletes verification rows that ran out before the run's time", async () => {
    vi.mocked(deleteExpiredVerifications).mockResolvedValueOnce(3)

    const result = await purgeOldData(db, now, nothingYet())

    expect(deleteExpiredVerifications).toHaveBeenCalledWith(db, {
      now: new Date("2026-03-20T03:17:00Z"),
      limit: 500,
    })
    expect(result).toMatchObject({ verifications: 3, complete: true })
  })

  it("deletes rate_limit rows only once they are a day old", async () => {
    vi.mocked(deleteOldRateLimits).mockResolvedValueOnce(7)

    const result = await purgeOldData(db, now, nothingYet())

    expect(deleteOldRateLimits).toHaveBeenCalledWith(db, {
      before: new Date("2026-03-19T03:17:00Z"),
      limit: 500,
    })
    expect(RATE_LIMIT_KEEP_HOURS).toBe(24)
    expect(result).toMatchObject({ rateLimits: 7, complete: true })
  })
})
