import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"

// The chat's model (spec §2 AI design): one config value. The owner chose it;
// the evals check it meets the bar, and a change goes back to the owner.
export const MODEL_ID = "openai/gpt-6-luna"

/** The model for one request. Tests pass a scripted model instead. */
export function createModel(env: {
  OPENROUTER_API_KEY: string
}): LanguageModel {
  return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(MODEL_ID)
}
