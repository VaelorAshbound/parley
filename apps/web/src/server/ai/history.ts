// How much of the chat the model sees each turn (spec §2 AI design: a server
// limit on history length). A long chat stays whole in the database; the
// model gets its latest messages, within a count and a size budget, so one
// turn's cost stays bounded however long the chat grows.

/**
 * The newest messages that fit both limits, in order. The newest one is
 * always kept: it is what the turn answers.
 */
export function recent<T>(
  messages: readonly T[],
  limit: { messages: number; characters: number }
): T[] {
  const kept: T[] = []
  let size = 0
  for (const message of messages.toReversed()) {
    size += JSON.stringify(message).length
    const fits = kept.length < limit.messages && size <= limit.characters
    if (!fits && kept.length > 0) break
    kept.push(message)
  }
  return kept.toReversed()
}
