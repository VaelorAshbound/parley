// How much of the chat the model sees each turn (spec §2 AI design: a server
// limit on history length). A long chat stays whole in the database; the
// model gets its latest messages, within a count and a size budget, so one
// turn's cost stays bounded however long the chat grows.

const size = (value: unknown) => JSON.stringify(value).length

/**
 * The newest messages that fit both limits, in order. The newest one is
 * always kept, as it is what the turn answers; if it alone is over the size
 * budget (a reply that grew through many questionnaires), its oldest parts
 * are left out. Each tool part holds its call and its result together, so
 * whole parts can go without leaving a call unanswered.
 */
export function recent<T extends { parts: readonly unknown[] }>(
  messages: readonly T[],
  limit: { messages: number; characters: number }
): T[] {
  const kept: T[] = []
  let total = 0
  for (const message of messages.toReversed()) {
    total += size(message)
    const fits = kept.length < limit.messages && total <= limit.characters
    if (!fits && kept.length > 0) break
    kept.push(fits ? message : trimmed(message, limit.characters))
  }
  return kept.toReversed()
}

/** The message with its oldest parts left out, down to the budget. */
function trimmed<T extends { parts: readonly unknown[] }>(
  message: T,
  characters: number
): T {
  const parts: unknown[] = []
  let total = size({ ...message, parts: [] })
  for (const part of message.parts.toReversed()) {
    total += size(part)
    if (total > characters && parts.length > 0) break
    parts.push(part)
  }
  return { ...message, parts: parts.toReversed() }
}
