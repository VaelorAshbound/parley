import {
  connect,
  deleteExpiredSessions,
  deleteIdleGuests,
  type Db,
} from "@workspace/db"
import { Temporal } from "temporal-polyfill"

import { logError, logInfo } from "./log"

// The nightly cleanup (spec §2 Limits, T28): guests with no activity for 7
// days go, with everything they own, and so do sessions that ran out.
//
// Once a day, at a quiet hour (UTC; `triggers` in wrangler.jsonc): each run
// wakes the Neon compute, which then stays up about 5 minutes before it
// scales to zero, so running more often would cost compute for nothing.
// Cron Triggers run on production only; Previews never call scheduled().
// https://developers.cloudflare.com/workers/previews/resources/#cron-triggers

/** Guests are deleted after this long without activity (spec §2 Limits). */
export const GUEST_IDLE_DAYS = 7

/** Rows per DELETE: short locks, and a small cascade each. */
const BATCH = 500
/**
 * Batches per kind per run: up to 10,000 rows. More waits for the next
 * night, and the log line says so (`complete: false`).
 */
const MAX_BATCHES = 20

/**
 * Deletes in batches until a batch comes back short (true: nothing left),
 * or the run's cap (false: more for the next run).
 */
export async function inBatches(
  deleteBatch: (limit: number) => Promise<number>,
  { size = BATCH, max = MAX_BATCHES } = {}
) {
  for (let batch = 0; batch < max; batch += 1) {
    if ((await deleteBatch(size)) < size) return true
  }
  return false
}

/** What a run has deleted so far, counted batch by batch. */
export type Purged = { guests: number; sessions: number }

/**
 * One purge at `now`. Safe to run again at any time: it deletes only what
 * is still out of date, and a failed run leaves the rest for the next one.
 * `purged` is counted up as batches commit, so after a failure it still
 * says what went (deletes can't be undone).
 */
export async function purgeOldData(
  db: Db,
  now: Temporal.Instant,
  purged: Purged = { guests: 0, sessions: 0 }
) {
  const at = new Date(now.epochMilliseconds)
  const inactiveSince = new Date(
    now.subtract({ hours: GUEST_IDLE_DAYS * 24 }).epochMilliseconds
  )
  // Guests first: their sessions' times count as activity.
  const guestsDone = await inBatches(async (limit) => {
    const count = await deleteIdleGuests(db, { now: at, inactiveSince, limit })
    purged.guests += count
    return count
  })
  const sessionsDone = await inBatches(async (limit) => {
    const count = await deleteExpiredSessions(db, { now: at, limit })
    purged.sessions += count
    return count
  })
  return { ...purged, complete: guestsDone && sessionsDone }
}

/**
 * The Worker's scheduled() handler. The time comes from the controller,
 * never the clock, so tests can set it. A failure is logged, with what the
 * run deleted before it, and thrown, so the Cron Events list shows the run
 * as failed.
 * https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
 */
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  controller,
  env
) => {
  const started = Date.now()
  const now = Temporal.Instant.fromEpochMilliseconds(controller.scheduledTime)
  const purged: Purged = { guests: 0, sessions: 0 }
  try {
    const db = await connect(env.HYPERDRIVE.connectionString)
    try {
      const result = await purgeOldData(db, now, purged)
      logInfo("purge_done", {
        cron: controller.cron,
        ...result,
        durationMs: Date.now() - started,
      })
    } finally {
      await db.$client.end()
    }
  } catch (error) {
    logError("purge_failed", error, { cron: controller.cron, ...purged })
    throw error
  }
}
