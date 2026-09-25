import { connect, deleteExpiredSessions, deleteIdleGuests } from "@workspace/db"
import { describe, expect, it, vi } from "vite-plus/test"

import { inBatches, scheduled } from "./cron"

// The deletes are faked here, so a run can fail halfway on purpose. The
// Worker tests (apps/web-worker-tests/test/cron.test.ts) run them for real.
vi.mock(import("@workspace/db"), async (original) => ({
  ...(await original()),
  connect: vi.fn<typeof connect>(),
  deleteIdleGuests: vi.fn<typeof deleteIdleGuests>(),
  deleteExpiredSessions: vi.fn<typeof deleteExpiredSessions>(),
}))

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

    const result = await inBatches(deleteBatch, { size: 2, max: 10 })

    expect(result).toEqual({ deleted: 5, complete: true })
    expect(limits).toEqual([2, 2, 2])
  })

  it("asks once more after a full batch, to see that nothing is left", async () => {
    const { deleteBatch, limits } = table(4)

    const result = await inBatches(deleteBatch, { size: 2, max: 10 })

    expect(result).toEqual({ deleted: 4, complete: true })
    expect(limits).toHaveLength(3)
  })

  it("stops at the cap and says there is more for the next run", async () => {
    const { deleteBatch, limits } = table(100)

    const result = await inBatches(deleteBatch, { size: 2, max: 3 })

    expect(result).toEqual({ deleted: 6, complete: false })
    expect(limits).toHaveLength(3)
  })

  it("deletes 500 rows a batch and 20 batches a run by default", async () => {
    const { deleteBatch, limits } = table(20_000)

    const result = await inBatches(deleteBatch)

    expect(result).toEqual({ deleted: 10_000, complete: false })
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
