import { and, eq, sql } from "drizzle-orm"

import { user } from "../auth-schema.ts"
import type { Db } from "../client.ts"
import { aiUsage, draft } from "../schema.ts"

/**
 * A guest signed up or signed in: their drafts (with the chat, which hangs
 * off the draft) and their AI usage become the account's, in one transaction.
 * Better Auth deletes the guest right after, and everything still on the
 * guest goes with it (cascade), so this must run first.
 *
 * It only ever moves data away from a guest: given a real account as `from`,
 * it moves nothing.
 */
export async function moveGuestData(
  db: Db,
  { from, to }: { from: string; to: string }
): Promise<{ drafts: number }> {
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, from), eq(user.isAnonymous, true)))
      // Nothing can turn the guest into a real account mid-move.
      .for("update")
    if (!guest) return { drafts: 0 }

    const drafts = await tx
      .update(draft)
      // A move is not an edit: the sidebar order stays as it was.
      .set({ userId: to, updatedAt: sql`${draft.updatedAt}` })
      .where(eq(draft.userId, from))
      .returning({ id: draft.id })

    // Today's messages still count toward today's limit, and the cost
    // records stay complete.
    await tx
      .insert(aiUsage)
      .select(
        tx
          .select({
            userId: sql<string>`${to}`.as("user_id"),
            day: aiUsage.day,
            messages: aiUsage.messages,
            inputTokens: aiUsage.inputTokens,
            outputTokens: aiUsage.outputTokens,
            costMicroUsd: aiUsage.costMicroUsd,
          })
          .from(aiUsage)
          .where(eq(aiUsage.userId, from))
      )
      .onConflictDoUpdate({
        target: [aiUsage.userId, aiUsage.day],
        set: {
          messages: sql`${aiUsage.messages} + excluded.messages`,
          inputTokens: sql`${aiUsage.inputTokens} + excluded.input_tokens`,
          outputTokens: sql`${aiUsage.outputTokens} + excluded.output_tokens`,
          costMicroUsd: sql`${aiUsage.costMicroUsd} + excluded.cost_micro_usd`,
        },
      })

    return { drafts: drafts.length }
  })
}
