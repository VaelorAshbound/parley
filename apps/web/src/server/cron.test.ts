import { describe, expect, it } from "vite-plus/test"

import { inBatches } from "./cron"

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
