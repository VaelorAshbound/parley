import type { ProviderMetadata, StepResult } from "ai"

import { z } from "../zod"
import type { runningTools } from "./tools"

// What one chat turn used and cost (T29), from the AI SDK's step results:
// counts, sums and durations only, never text. On-call and the owner read
// them from the `chat_turn` log line in Workers Observability.

// OpenRouter puts what it charged for each call in the provider metadata
// (`usage.cost`, in dollars; every response has it):
// https://openrouter.ai/docs/use-cases/usage-accounting
const charged = z.object({
  openrouter: z.object({ usage: z.object({ cost: z.number() }) }),
})

/** What OpenRouter charged for one model call, in dollars, if it said. */
export function chargedUsd(metadata: ProviderMetadata | undefined) {
  const parsed = charged.safeParse(metadata)
  return parsed.success ? parsed.data.openrouter.usage.cost : undefined
}

/** One finished model step of a chat turn, with the chat's tools. */
export type TurnStep = StepResult<ReturnType<typeof runningTools>>

export function turnMetrics(steps: readonly TurnStep[]) {
  let inputTokens = 0
  let cachedInputTokens = 0
  let outputTokens = 0
  let usd: number | undefined = 0
  let toolCalls = 0
  let toolErrors = 0
  let rejectedChanges = 0
  const failedTools = new Set<string>()

  for (const step of steps) {
    inputTokens += step.usage.inputTokens ?? 0
    cachedInputTokens += step.usage.inputTokenDetails.cacheReadTokens ?? 0
    outputTokens += step.usage.outputTokens ?? 0
    const cost = chargedUsd(step.providerMetadata)
    // One call without a price makes the sum unknown, not smaller.
    usd = usd === undefined || cost === undefined ? undefined : usd + cost
    for (const part of step.content) {
      if (part.type === "tool-call") toolCalls += 1
      if (part.type === "tool-error") {
        toolErrors += 1
        failedTools.add(part.toolName)
      }
      // Changes the engine refused (a wrong key, a bad value): the model
      // gets the reason and may fix them in the same turn.
      if (
        part.type === "tool-result" &&
        !part.dynamic &&
        part.toolName === "updateFields"
      )
        rejectedChanges += part.output.rejected.length
    }
  }

  return {
    model: steps[0]?.model.modelId,
    finishReason: steps.at(-1)?.finishReason,
    steps: steps.length,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    // Millionths of a dollar, an exact integer, as aiUsage stores it.
    costMicroUsd:
      usd === undefined || steps.length === 0
        ? undefined
        : Math.round(usd * 1_000_000),
    // The first step's: what the user waits for before anything shows.
    ttftMs: steps[0]?.performance.timeToFirstOutputMs,
    toolCalls,
    toolErrors,
    failedTools: [...failedTools].sort().join(",") || undefined,
    rejectedChanges,
  }
}
