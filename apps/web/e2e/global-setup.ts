import type { FullConfig } from "@playwright/test"

/**
 * Stops the run before any test when the target would chat with the paid
 * model: the e2e tests need the scripted AI (SCRIPTED_AI=on, on Previews
 * and in local dev's .dev.vars).
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  const response = await fetch(new URL("/api/version", baseURL))
  const { scriptedAi } = (await response.json()) as { scriptedAi?: boolean }
  if (!scriptedAi)
    throw new Error(
      `${baseURL} has the scripted AI off, so the chat tests would use the paid model. Set SCRIPTED_AI=on (apps/web/.dev.vars for local dev).`
    )
}
