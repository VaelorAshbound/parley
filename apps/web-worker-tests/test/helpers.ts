import { connect } from "@workspace/db"
import { env } from "cloudflare:workers"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { simulateReadableStream, type LanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterAll, expect, onTestFinished } from "vitest"

import { api } from "../../web/src/server/api"
import { createAuth } from "../../web/src/server/auth"
import { createServerClient } from "../../web/src/server/rpc/server-client"

export const origin = "http://localhost:3000"

/** One request through the real /api app, as the browser would send it. */
export async function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has("origin")) headers.set("origin", origin)
  // Every real HTTP request has one; Better Auth builds its URL from it.
  if (!headers.has("host")) headers.set("host", new URL(origin).host)
  // Each call is its own client, as far as the rate limiter can tell.
  if (!headers.has("cf-connecting-ip"))
    headers.set("cf-connecting-ip", randomIp())
  const ctx = createExecutionContext()
  const response = await api.fetch(
    new Request(origin + path, { ...init, headers }),
    env,
    ctx
  )
  await waitOnExecutionContext(ctx)
  return response
}

/** The Cookie header a browser would send back after this response. */
export function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

/** A new guest, as the first visit that needs a session makes one. */
export async function signInGuest() {
  const response = await call("/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  expect(response.status).toBe(200)
  return { cookie: cookiesFrom(response) }
}

/** Calls procedures in-process with the given cookie (or none), like SSR. */
export async function serverClient(cookie?: string) {
  return (await chatClient(cookie, scriptedModel([[{ text: "Hi." }]]))).client
}

/**
 * Like serverClient, with the chat's model given. `settle` waits for the
 * work left after the response (saving the reply), as the Worker would.
 */
export async function chatClient(
  cookie: string | undefined,
  model: LanguageModel
) {
  const db = await connect(env.HYPERDRIVE.connectionString)
  const ctx = createExecutionContext()
  const reqHeaders = new Headers({ host: "localhost:3000" })
  if (cookie) reqHeaders.set("cookie", cookie)
  // Kept here too: an execution context can be waited on only once.
  const later: Promise<unknown>[] = []
  const waitUntil = (promise: Promise<unknown>) => {
    later.push(promise)
    ctx.waitUntil(promise)
  }
  const client = createServerClient({
    db,
    auth: createAuth({ db, env, waitUntil }),
    model,
    waitUntil,
    reqHeaders,
    resHeaders: new Headers(),
  })
  // A real Worker's request ends and takes its socket with it; these
  // in-process clients don't, and a run once ran the test Postgres out of
  // connections. Each closes after its test (and its pending saves), or
  // after its file when made while the file is collected (the auth matrix).
  const close = async () => {
    await Promise.allSettled(later)
    await db.$client.end()
  }
  if (expect.getState().currentTestName === undefined) afterAll(close)
  else onTestFinished(close)
  return { client, settle: () => Promise.all(later.splice(0)) }
}

/** What a model streams, from the mock's own types (no provider package). */
type StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV4["doStream"]>
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never

/** One model step: some text and/or tool calls, in order. */
export type Step = ({ text: string } | { tool: string; input: unknown })[]

/**
 * A scripted model (AI SDK MockLanguageModelV4): each call streams the next
 * step. Its `doStreamCalls` show what the model was sent.
 */
export function scriptedModel(steps: Step[]) {
  let call = 0
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(call, steps.length - 1)] ?? []
      call += 1
      const calls = step.some((part) => "tool" in part)
      return {
        stream: simulateReadableStream({
          chunks: [
            ...step.flatMap((part, index): StreamPart[] =>
              "text" in part
                ? [
                    { type: "text-start", id: `t${index}` },
                    { type: "text-delta", id: `t${index}`, delta: part.text },
                    { type: "text-end", id: `t${index}` },
                  ]
                : [
                    {
                      type: "tool-call",
                      toolCallId: `call-${call}-${index}`,
                      toolName: part.tool,
                      input: JSON.stringify(part.input),
                    },
                  ]
            ),
            {
              type: "finish",
              finishReason: {
                unified: calls ? "tool-calls" : "stop",
                raw: undefined,
              },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 5, text: 5, reasoning: undefined },
              },
            },
          ],
        }),
      }
    },
  })
}

function randomIp() {
  const [a = 0, b = 0, c = 0] = crypto.getRandomValues(new Uint8Array(3))
  return `10.${a}.${b}.${c}`
}
