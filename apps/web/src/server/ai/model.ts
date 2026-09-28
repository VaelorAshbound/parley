import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import { parse } from "hono/utils/cookie"

// The chat's model (spec §2 AI design): one config value. The owner chose it;
// the evals check it meets the bar, and a change goes back to the owner.
export const MODEL_ID = "openai/gpt-6-luna"

/** The real model. Tests pass a scripted model instead. */
export function createModel(
  env: Pick<Env, "OPENROUTER_API_KEY">
): LanguageModel {
  return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(MODEL_ID)
}

/** The cookie that asks for the scripted AI (e2e/helpers.ts sets it). */
export const SCRIPTED_AI_COOKIE = "parley-scripted-ai"

/**
 * The model for one request. Where SCRIPTED_AI is on (Previews, local dev;
 * never production), a browser with the scripted-AI cookie gets the scripted
 * AI of the fast e2e tests (T32).
 */
export async function requestModel(
  env: Pick<Env, "OPENROUTER_API_KEY"> & { SCRIPTED_AI: string },
  cookieHeader: string | undefined
): Promise<LanguageModel> {
  if (
    env.SCRIPTED_AI === "on" &&
    cookieHeader &&
    parse(cookieHeader, SCRIPTED_AI_COOKIE)[SCRIPTED_AI_COOKIE] === "1"
  ) {
    // Loaded only when used, so production never runs its code.
    const { scriptedModel } = await import("./scripted-model")
    return scriptedModel()
  }
  return createModel(env)
}
