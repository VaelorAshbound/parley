import { and, eq, sql } from "drizzle-orm"

import type { Db } from "../client.ts"
import { aiUsage } from "../schema.ts"

// A user's AI use per UTC day (spec §2 Limits): messages for the daily
// limit, and the tokens and cost of the model's replies. The limits
// themselves are in the app (server/limits.ts).

type Day = { userId: string; day: string }

/**
 * Counts one message for the user's day if they have fewer than `limit`.
 * False when the limit is reached (nothing changes). One statement, so two
 * messages at once can't both take the last place: the insert or the
 * row-locked update decides.
 */
export async function claimMessage(
  db: Db,
  { userId, day, limit }: Day & { limit: number }
) {
  if (limit <= 0) return false
  const rows = await db
    .insert(aiUsage)
    .values({ userId, day, messages: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { messages: sql`${aiUsage.messages} + 1` },
      setWhere: sql`${aiUsage.messages} < ${limit}`,
    })
    .returning({ messages: aiUsage.messages })
  return rows.length > 0
}

/** Adds one reply's tokens and cost (millionths of a dollar) to the day. */
export async function addAiUsage(
  db: Db,
  {
    userId,
    day,
    inputTokens,
    outputTokens,
    costMicroUsd,
  }: Day & { inputTokens: number; outputTokens: number; costMicroUsd: number }
) {
  await db
    .insert(aiUsage)
    .values({ userId, day, inputTokens, outputTokens, costMicroUsd })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        inputTokens: sql`${aiUsage.inputTokens} + excluded.input_tokens`,
        outputTokens: sql`${aiUsage.outputTokens} + excluded.output_tokens`,
        costMicroUsd: sql`${aiUsage.costMicroUsd} + excluded.cost_micro_usd`,
      },
    })
}

/** The user's use on one day, if any. */
export async function aiUsageOn(db: Db, { userId, day }: Day) {
  const [row] = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
  return row
}
