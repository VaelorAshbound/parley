import { describe, expect, it } from "vite-plus/test"

import { chargedUsd, turnMetrics, type TurnStep } from "./metrics"

// The workerd chat tests cover whole turns; these cover the cost's edges.

/** A finished step with only what turnMetrics reads. */
function step(cost?: number): TurnStep {
  return {
    model: { provider: "openrouter", modelId: "openai/gpt-6-luna" },
    finishReason: "stop",
    usage: {
      inputTokens: 1000,
      inputTokenDetails: {
        noCacheTokens: 400,
        cacheReadTokens: 600,
        cacheWriteTokens: undefined,
      },
      outputTokens: 50,
      outputTokenDetails: { textTokens: 50, reasoningTokens: undefined },
      totalTokens: 1050,
    },
    providerMetadata:
      cost === undefined ? undefined : { openrouter: { usage: { cost } } },
    performance: { timeToFirstOutputMs: 420 },
    content: [],
  } as unknown as TurnStep
}

describe("chargedUsd", () => {
  it("reads what OpenRouter charged for a call", () => {
    expect(chargedUsd({ openrouter: { usage: { cost: 0.000131 } } })).toBe(
      0.000131
    )
  })

  it("is unknown when the provider didn't say", () => {
    expect(chargedUsd(undefined)).toBeUndefined()
    expect(chargedUsd({ openrouter: { usage: {} } })).toBeUndefined()
  })
})

describe("turnMetrics", () => {
  it("sums tokens and cost over the steps, in whole millionths of a dollar", () => {
    expect(turnMetrics([step(0.0000761), step(0.0000762)])).toMatchObject({
      steps: 2,
      inputTokens: 2000,
      cachedInputTokens: 1200,
      outputTokens: 100,
      costMicroUsd: 152,
      ttftMs: 420,
    })
  })

  it("leaves the cost out when one call had no price, rather than undercount", () => {
    expect(turnMetrics([step(0.00008), step()]).costMicroUsd).toBeUndefined()
  })

  it("leaves the cost out of a turn with no finished step", () => {
    expect(turnMetrics([])).toMatchObject({
      steps: 0,
      costMicroUsd: undefined,
      model: undefined,
    })
  })
})
