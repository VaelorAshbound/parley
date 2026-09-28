import { asSchema } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, it } from "vite-plus/test"

import { scriptedModel, scripts } from "./scripted-model"
import { chatTools } from "./tools"

type Prompt = Parameters<MockLanguageModelV4["doStream"]>[0]["prompt"]

/** What the scripted AI does next, after this chat: texts and tool names. */
async function next(prompt: Prompt) {
  const model = scriptedModel()
  const { stream } = await model.doStream({ prompt })
  const done: string[] = []
  for await (const part of stream) {
    if (part.type === "text-delta") done.push(part.delta)
    if (part.type === "tool-call") done.push(part.toolName)
  }
  return done
}

const user = (text: string): Prompt[number] => ({
  role: "user",
  content: [{ type: "text", text }],
})
const call = (toolName: string): Prompt[number] => ({
  role: "assistant",
  content: [{ type: "tool-call", toolCallId: toolName, toolName, input: {} }],
})

describe("scriptedModel", () => {
  it("plays its script one step per call, by what it already did", async () => {
    const asked = user("We share our Roadmap with a vendor")
    expect(await next([asked])).toEqual(["chooseDocument"])
    expect(await next([asked, call("chooseDocument")])).toEqual([
      "updateFields",
    ])
    expect(
      await next([asked, call("chooseDocument"), call("updateFields")])
    ).toEqual(["I picked the Mutual NDA and filled in the purpose."])
  })

  it("starts over at each new user message", async () => {
    expect(
      await next([user("ask me"), call("askQuestions"), user("hello")])
    ).toEqual(["I'm a scripted reply for tests."])
  })
})

// Each tool's input schema, by the tool's name.
const schemas = new Map<string, Parameters<typeof asSchema>[0]>(
  Object.entries(chatTools).map(([name, { inputSchema }]) => [
    name,
    inputSchema,
  ])
)

describe("scripts", () => {
  it.each(
    scripts.flatMap(({ when, steps }) =>
      steps
        .flat()
        .flatMap((part) =>
          "tool" in part ? [{ when: String(when), ...part }] : []
        )
    )
  )("$when: $tool is sent as the tool takes it", async ({ tool, input }) => {
    const schema = schemas.get(tool)
    expect(schema, `${tool} is one of the chat's tools`).toBeDefined()
    const result = await asSchema(schema).validate?.(input)
    expect(result).toMatchObject({ success: true })
  })
})
