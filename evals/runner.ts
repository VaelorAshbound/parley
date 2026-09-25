import { connect } from "@workspace/db"
import {
  generateText,
  getToolName,
  isToolUIPart,
  Output,
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
} from "ai"

import type { ChatMessage } from "../apps/web/src/server/ai/chat"
import { createModel } from "../apps/web/src/server/ai/model"
import {
  answersFor,
  answersShape,
  type Answers,
  type Question,
} from "../apps/web/src/server/ai/questions"
import { z } from "../apps/web/src/server/zod"
import { createAuth } from "../apps/web/src/server/auth"
import { createServerClient } from "../apps/web/src/server/rpc/server-client"

// Runs eval conversations through the same chat procedure the browser calls
// (tools, engine, database), with the real model. A simulated user plays the
// other side: it knows only the case's facts, and answers in the chat or in
// the AI's questionnaire.

/** OpenRouter list prices for openai/gpt-6-luna, $ per million tokens (spec §2). */
const PRICE = { input: 0.1, cachedInput: 0.01, output: 0.5 }

export type Usage = {
  calls: number
  input: number
  cached: number
  output: number
}

export function cost(usage: Usage) {
  return (
    ((usage.input - usage.cached) * PRICE.input +
      usage.cached * PRICE.cachedInput +
      usage.output * PRICE.output) /
    1_000_000
  )
}

/** The chat's model, counting every call's tokens from its stream's finish. */
export function meteredModel(apiKey: string) {
  const base = createModel({ OPENROUTER_API_KEY: apiKey })
  if (typeof base === "string") throw new Error("Expected a model object")
  const usage: Usage = { calls: 0, input: 0, cached: 0, output: 0 }
  const middleware: LanguageModelMiddleware = {
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream()
      return {
        ...rest,
        stream: stream.pipeThrough(
          new TransformStream({
            transform(part, controller) {
              if (part.type === "finish") {
                usage.calls += 1
                usage.input += part.usage.inputTokens.total ?? 0
                usage.cached += part.usage.inputTokens.cacheRead ?? 0
                usage.output += part.usage.outputTokens.total ?? 0
              }
              controller.enqueue(part)
            },
          })
        ),
      }
    },
  }
  return { model: wrapLanguageModel({ model: base, middleware }), usage }
}

/** A new guest with a fresh draft's worth of chat, like a first visit. */
export async function openChat(databaseUrl: string, model: LanguageModel) {
  const db = await connect(databaseUrl)
  const later: Promise<unknown>[] = []
  const waitUntil = (promise: Promise<unknown>) => {
    later.push(promise)
  }
  const host = new Headers({ host: "localhost:3000" })
  const auth = createAuth({
    db,
    env: {
      BETTER_AUTH_SECRET: "eval-only-secret-that-is-long-enough-0123456789",
      STAGE: "production",
    },
    waitUntil,
  })
  const { headers } = await auth.api.signInAnonymous({
    headers: host,
    returnHeaders: true,
  })
  const cookie = headers
    .getSetCookie()
    .map((each) => each.split(";")[0])
    .join("; ")
  const client = createServerClient({
    db,
    auth,
    model,
    waitUntil,
    reqHeaders: new Headers({ host: "localhost:3000", cookie }),
    resHeaders: new Headers(),
  })
  return {
    client,
    /** Reads a whole reply, then waits for its save, as the Worker would. */
    async finish(reply: AsyncIterable<unknown>) {
      for await (const _chunk of reply);
      await Promise.all(later.splice(0))
    },
    close: () => db.$client.end(),
  }
}

export type Chat = Awaited<ReturnType<typeof openChat>>

/** A user's message, with an id like the ones useChat makes. */
export function say(text: string) {
  return {
    id: crypto.randomUUID(),
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  }
}

/** Every questionnaire the AI is waiting on (one step may ask two). */
export function openQuestions(messages: ChatMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== "assistant") return []
  return last.parts.flatMap((part) =>
    part.type === "tool-askQuestions" && part.state === "input-available"
      ? [{ toolCallId: part.toolCallId, questions: part.input.questions }]
      : []
  )
}

/** The chat as plain lines, for the simulated user to read. */
export function transcript(messages: ChatMessage[]) {
  return messages
    .flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === "text"
          ? [`${message.role === "user" ? "User" : "Parley"}: ${part.text}`]
          : []
      )
    )
    .join("\n")
}

const answerList = z.object({
  answers: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
})

const USER = `You play a user of Parley, an app that drafts legal agreements by chat. You know only these facts:

{facts}

Rules: answer only what Parley asks, in short plain words, using only the facts. If Parley asks something the facts don't cover, say you don't know and let Parley use its default. Never add facts.`

/** The simulated user's next chat message. */
export async function userReply(
  model: LanguageModel,
  facts: string,
  chat: string
) {
  const { text } = await generateText({
    model,
    instructions: USER.replace("{facts}", facts),
    prompt: `The chat so far:\n${chat}\n\nWrite your next message.`,
  })
  return text
}

/**
 * The simulated user's answers to a questionnaire, checked like the server
 * checks them. One retry with the reason if the first try doesn't fit.
 */
export async function userAnswers(
  model: LanguageModel,
  facts: string,
  questions: Question[]
): Promise<Answers> {
  const listed = questions
    .map(
      (question) =>
        `- ${question.name}: ${question.prompt}${question.required ? " (required)" : " (optional: leave it out to skip)"}${question.multiple ? " (several allowed)" : ""}${question.showIf ? ` (only if ${question.showIf.question} is one of ${question.showIf.answers.join(", ")})` : ""}
  choices: ${question.choices.map((choice) => `${choice.value} = ${choice.label}`).join("; ") || "none"}; or type your own answer`
    )
    .join("\n")
  let reason = ""
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { output } = await generateText({
      model,
      instructions: USER.replace("{facts}", facts),
      // A list, not a record: OpenAI's structured outputs refuse a JSON
      // Schema with propertyNames.
      output: Output.object({ schema: answerList }),
      prompt: `Parley shows you these questions:
${listed}

Answer each by its name, with a list of values: a choice's value when one fits, or your own short words where allowed. Leave out optional questions the facts don't cover, and questions whose condition isn't met.${reason}`,
    })
    const checked = answersFor(questions).safeParse({
      answers: Object.fromEntries(
        output.answers.map((each) => [each.name, each.values])
      ),
    })
    if (checked.success) return answersShape.parse(checked.data).answers
    reason = `\n\nYour last answers were refused: ${checked.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
  }
  throw new Error(`The simulated user couldn't answer: ${reason}`)
}

/**
 * The whole chat as Markdown, tool calls and refusals included: what to read
 * when a case fails. Written to evals/.transcripts/ (not committed).
 */
export function fullTranscript(messages: ChatMessage[]) {
  const lines: string[] = []
  for (const message of messages)
    for (const part of message.parts) {
      if (part.type === "text")
        lines.push(
          `**${message.role === "user" ? "User" : "Parley"}:** ${part.text}`
        )
      else if (isToolUIPart(part)) {
        const out =
          part.state === "output-available"
            ? JSON.stringify(part.output)
            : part.state === "output-error"
              ? `ERROR ${part.errorText}`
              : part.state
        // A call whose input didn't fit the tool's schema is stored without
        // one; it still counts as a failed write, so it must show here.
        const input =
          part.input === undefined
            ? "(no valid input)"
            : JSON.stringify(part.input)
        lines.push(`- \`${getToolName(part)}\` ${input}\n  → ${out}`)
      }
    }
  return lines.join("\n\n")
}
