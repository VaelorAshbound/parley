// Try again after an answer turn failed (PAR-7): the reply goes back to the
// end of the step whose questionnaires were last answered, and those answers
// are sent again. The page (features/chat/transport.ts) and the server
// (server/ai/chat.ts) cut the reply here, so both cut it the same way.

type PartLike = { readonly type: string; readonly state?: string }

function isAnswered(part: PartLike) {
  return part.type === "tool-askQuestions" && part.state === "output-available"
}

/**
 * Where the step with the reply's last answered questionnaires starts and
 * ends (part indexes, end exclusive): what the failed turn wrote after it,
 * new questions too, is what a retry takes back. Null when nothing in the
 * reply was answered.
 */
export function answeredStep(parts: readonly PartLike[]) {
  const answeredAt = parts.findLastIndex(isAnswered)
  if (answeredAt === -1) return null
  const start =
    parts.findLastIndex(
      (part, index) => index < answeredAt && part.type === "step-start"
    ) + 1
  const next = parts.findIndex(
    (part, index) => index > answeredAt && part.type === "step-start"
  )
  return { start, end: next === -1 ? parts.length : next }
}
