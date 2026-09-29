import type { TestInfo } from "@playwright/test"

// What a real test spent on OpenRouter (spec §6: cost per document is
// recorded). Previews chat on the capped test key; its running total comes
// from OpenRouter's key endpoint, read before and after the test. It adds
// a "cost" note to the report, or nothing without OPENROUTER_API_KEY_TEST.
// https://openrouter.ai/docs/api/reference/limits

async function usage() {
  const key = process.env.OPENROUTER_API_KEY_TEST
  if (!key) return undefined
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { authorization: `Bearer ${key}` },
  })
  if (!response.ok) return undefined
  const { data } = (await response.json()) as { data: { usage: number } }
  return data.usage
}

/** Starts counting; the returned function notes the spend on the test. */
export async function spend(testInfo: TestInfo) {
  const before = await usage()
  return async () => {
    // OpenRouter adds a generation's cost a moment after it ends.
    await new Promise((resolve) => setTimeout(resolve, 5_000))
    const after = await usage()
    if (before === undefined || after === undefined) return
    const description = `$${(after - before).toFixed(4)} on the OpenRouter test key`
    testInfo.annotations.push({ type: "cost", description })
    console.log(`${testInfo.title}: ${description}`)
  }
}
