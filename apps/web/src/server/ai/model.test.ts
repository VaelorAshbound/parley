import { describe, expect, it } from "vite-plus/test"

import { requestModel, MODEL_ID } from "./model"

const modelId = (model: Awaited<ReturnType<typeof requestModel>>) =>
  typeof model === "string" ? model : model.modelId

const cookie = "better-auth.session_token=s; parley-scripted-ai=1"

describe("requestModel", () => {
  it("uses the real model in production, even with the test cookie", async () => {
    const model = await requestModel(
      { OPENROUTER_API_KEY: "k", SCRIPTED_AI: "off" },
      cookie
    )
    expect(modelId(model)).toBe(MODEL_ID)
  })

  it("uses the scripted AI where it is on and the browser asks for it", async () => {
    const model = await requestModel(
      { OPENROUTER_API_KEY: "k", SCRIPTED_AI: "on" },
      cookie
    )
    expect(modelId(model)).toBe("scripted")
  })

  it.each(["0", "false", ""])(
    "uses the real model for the cookie set to %j",
    async (value) => {
      const model = await requestModel(
        { OPENROUTER_API_KEY: "k", SCRIPTED_AI: "on" },
        `parley-scripted-ai=${value}`
      )
      expect(modelId(model)).toBe(MODEL_ID)
    }
  )

  it("uses the real model where it is on but the browser didn't ask", async () => {
    const model = await requestModel(
      { OPENROUTER_API_KEY: "k", SCRIPTED_AI: "on" },
      "parley-scripted-ai-other=1"
    )
    expect(modelId(model)).toBe(MODEL_ID)
  })
})

describe("wrangler.jsonc", () => {
  it("keeps the scripted AI off in production and on for Previews", async () => {
    // TypeScript's own reader of JSON with comments (tsconfig files).
    const { parseConfigFileTextToJson } = await import("typescript")
    const { readFile } = await import("node:fs/promises")
    const file = new URL("../../../wrangler.jsonc", import.meta.url)
    const { config } = parseConfigFileTextToJson(
      file.pathname,
      await readFile(file, "utf8")
    ) as {
      config: {
        vars: Record<string, string>
        previews: { vars: Record<string, string> }
      }
    }

    expect(config.vars["SCRIPTED_AI"]).toBe("off")
    expect(config.previews.vars["SCRIPTED_AI"]).toBe("on")
  })
})
