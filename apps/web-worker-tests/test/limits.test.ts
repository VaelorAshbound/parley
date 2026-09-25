import { schema } from "@workspace/db"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { createAuth } from "../../web/src/server/auth"
import {
  DAILY_MESSAGES,
  GUEST_DRAFTS,
  GUESTS_PER_NETWORK,
  RATE_LIMITS,
} from "../../web/src/server/limits"
import {
  browserClient,
  call,
  chatClient,
  database,
  origin,
  scriptedModel,
  serverClient,
  signInGuest,
  signUpUser,
  signUpVerified,
} from "./helpers"

// Spec §2 Limits, each at its edge (T27): the last request that fits
// passes, and the next one is refused with a typed answer.

function randomIp() {
  return `198.51.100.${Math.floor(Math.random() * 250) + 1}`
}

const today = "2026-09-25"

const {
  AI_RATE_LIMITER: ai,
  EXPORT_RATE_LIMITER: exports,
  RPC_RATE_LIMITER: rpc,
} = RATE_LIMITS

/**
 * Waits for a new rate-limit window when too little of this one is left for
 * the test's burst. Miniflare's limiter counts in windows on the wall clock
 * (`period` seconds); a burst across two windows would never reach the edge.
 */
async function roomInWindow(period: number, needMs: number) {
  const left = period * 1000 - (Date.now() % (period * 1000))
  if (left < needMs)
    await new Promise((resolve) => setTimeout(resolve, left + 50))
}

function say(text: string) {
  return {
    id: crypto.randomUUID(),
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  }
}

async function read(stream: AsyncIterable<unknown>) {
  for await (const _ of stream);
}

describe("the AI routes", () => {
  it(
    `take ${ai.limit} turns in ${ai.period} s from one user, then say to wait`,
    { timeout: 90_000 },
    async () => {
      const { client, settle } = await chatClient(
        (await signInGuest()).cookie,
        scriptedModel([[{ text: "Noted." }]])
      )
      const draft = await client.drafts.create({ today })
      await roomInWindow(ai.period, 5000)

      for (let turn = 1; turn <= ai.limit; turn++)
        await read(
          await client.chat.send({ id: draft.id, message: say("Hi"), today })
        )
      const error = await client.chat
        .send({ id: draft.id, message: say("One more"), today })
        .catch((each: unknown) => each)
      await settle()

      expect(error).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        status: 429,
        defined: true,
      })
      // Refused before anything was saved: the chat has the 10 turns only.
      expect(await client.chat.messages({ id: draft.id })).toHaveLength(
        2 * ai.limit
      )
    }
  )

  it(
    "count answers to the AI's questions too",
    { timeout: 90_000 },
    async () => {
      const { client } = await chatClient(
        (await signInGuest()).cookie,
        scriptedModel([[{ text: "Noted." }]])
      )
      const draft = await client.drafts.create({ today })
      const answer = () =>
        client.chat
          .answer({
            id: draft.id,
            calls: [{ toolCallId: "call-1-0", answers: {} }],
            today,
          })
          .catch((each: unknown) => each)
      await roomInWindow(ai.period, 3000)

      // Nothing is open, so each is refused, after it counted.
      for (let turn = 1; turn <= ai.limit; turn++)
        expect(await answer()).toMatchObject({ code: "NOT_OPEN" })

      expect(await answer()).toMatchObject({ code: "TOO_MANY_REQUESTS" })
    }
  )
})

describe("daily AI messages", () => {
  /** Today in UTC, the day the limits count in. */
  const utcToday = () => new Date().toISOString().slice(0, 10)
  const nextUtcMidnight = () =>
    new Date(`${utcToday()}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000

  /** A draft whose owner has used `used` messages today. */
  async function usedToday(
    cookie: string,
    used: number,
    steps = [[{ text: "Noted." }]] as Parameters<typeof scriptedModel>[0]
  ) {
    const { client, settle } = await chatClient(cookie, scriptedModel(steps))
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    const db = await database()
    await db
      .insert(schema.aiUsage)
      .values({ userId: draft.userId, day: utcToday(), messages: used })
    const usage = async () =>
      (
        await db
          .select()
          .from(schema.aiUsage)
          .where(eq(schema.aiUsage.userId, draft.userId))
      )[0]
    return { client, settle, draft, usage }
  }

  it.each([
    ["guest", DAILY_MESSAGES.guest, () => signInGuest()],
    ["free", DAILY_MESSAGES.free, () => signUpUser()],
  ] as const)(
    "a %s's last message of the day goes through, the next says when they come back",
    async (tier, limit, signIn) => {
      const { client, settle, draft, usage } = await usedToday(
        (await signIn()).cookie,
        limit - 1
      )

      await read(
        await client.chat.send({ id: draft.id, message: say("Last"), today })
      )
      await settle()
      const error = await client.chat
        .send({ id: draft.id, message: say("One more"), today })
        .catch((each: unknown) => each)

      expect(error).toMatchObject({
        code: "DAILY_LIMIT",
        status: 429,
        defined: true,
        data: {
          limit,
          tier,
          resetsAt: new Date(nextUtcMidnight()).toISOString(),
        },
      })
      // The refused message wasn't saved, and didn't count.
      expect(await client.chat.messages({ id: draft.id })).toHaveLength(2)
      expect((await usage())?.messages).toBe(limit)
    }
  )

  it("counts answers to the AI's questions too", async () => {
    const ask = {
      tool: "askQuestions",
      input: {
        title: "Key terms",
        questions: [
          {
            name: "term",
            prompt: "How long should the NDA last?",
            required: true,
            choices: [{ value: "1y", label: "1 year" }],
            multiple: false,
          },
        ],
      },
    }
    const { client, settle, draft } = await usedToday(
      (await signInGuest()).cookie,
      DAILY_MESSAGES.guest - 1,
      [[ask]]
    )
    await read(
      await client.chat.send({ id: draft.id, message: say("Help"), today })
    )
    await settle()

    const error = await client.chat
      .answer({
        id: draft.id,
        calls: [{ toolCallId: "call-1-0", answers: { term: ["1y"] } }],
        today,
      })
      .catch((each: unknown) => each)

    expect(error).toMatchObject({ code: "DAILY_LIMIT", defined: true })
  })

  it("records each reply's tokens and cost for the day", async () => {
    const { client, settle, draft, usage } = await usedToday(
      (await signInGuest()).cookie,
      0
    )

    await read(
      await client.chat.send({ id: draft.id, message: say("Hi"), today })
    )
    await settle()

    // The scripted model: 10 input and 5 output tokens, $0.00002 a call.
    expect(await usage()).toMatchObject({
      messages: 1,
      inputTokens: 10,
      outputTokens: 5,
      costMicroUsd: 20,
    })
  })
})

describe("downloads", () => {
  it(
    `take ${exports.limit} in ${exports.period} s from one user, then answer 429 over HTTP`,
    { timeout: 90_000 },
    async () => {
      const { cookie } = await signUpVerified()
      const client = browserClient(cookie)
      const draft = await client.drafts.create({
        documentId: "mutual-nda",
        today,
      })
      await roomInWindow(exports.period, 15_000)

      // The draft is empty, so each stops at INCOMPLETE, after it counted.
      for (let each = 1; each <= exports.limit; each++)
        await expect(client.export.pdf({ id: draft.id })).rejects.toMatchObject(
          {
            code: "INCOMPLETE",
          }
        )
      const refused = await call("/api/rpc/export/pdf", {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
          "x-csrf-token": "orpc",
        },
        body: JSON.stringify({ json: { id: draft.id } }),
      })

      expect(refused.status).toBe(429)
      expect(await refused.json()).toMatchObject({
        json: { code: "TOO_MANY_REQUESTS", defined: true },
      })
    }
  )
})

describe("every procedure", () => {
  it(
    `takes ${rpc.limit} calls in ${rpc.period} s from one user, then says to wait`,
    { timeout: 90_000 },
    async () => {
      const { cookie } = await signInGuest()
      // In-process, on one database connection: 300 HTTP calls would each
      // keep one open until the file ends. The same middleware runs.
      const client = await serverClient(cookie)
      const other = browserClient((await signInGuest()).cookie)
      await roomInWindow(rpc.period, 30_000)

      for (let each = 1; each <= rpc.limit; each++) await client.drafts.list({})

      await expect(browserClient(cookie).drafts.list({})).rejects.toMatchObject(
        {
          code: "TOO_MANY_REQUESTS",
          status: 429,
        }
      )
      // Per user: someone else is not held up.
      await expect(other.drafts.list({})).resolves.toEqual([])
    }
  )
})

describe("a guest's drafts", () => {
  it(`keeps ${GUEST_DRAFTS}; the next asks for an account`, async () => {
    const client = browserClient((await signInGuest()).cookie)
    await client.drafts.create({ documentId: "mutual-nda", today })

    const error = await client.drafts
      .create({ documentId: "mutual-nda", today })
      .catch((each: unknown) => each)

    expect(error).toMatchObject({
      code: "DRAFT_LIMIT",
      status: 403,
      defined: true,
      data: { limit: GUEST_DRAFTS },
    })
    expect(await client.drafts.list({})).toHaveLength(GUEST_DRAFTS)
  })

  it("two at once make one draft", async () => {
    const client = browserClient((await signInGuest()).cookie)

    const results = await Promise.allSettled([
      client.drafts.create({ today }),
      client.drafts.create({ today }),
    ])

    expect(results.map((each) => each.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ])
    expect(await client.drafts.list({})).toHaveLength(1)
  })

  it("can't be copied", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })

    await expect(
      client.drafts.duplicate({ id: draft.id })
    ).rejects.toMatchObject({ code: "DRAFT_LIMIT", defined: true })
  })

  it("has room again once the draft is deleted", async () => {
    const client = browserClient((await signInGuest()).cookie)
    const draft = await client.drafts.create({ today })
    await client.drafts.delete({ id: draft.id })

    await expect(client.drafts.create({ today })).resolves.toBeDefined()
  })

  it("an account has no draft limit", async () => {
    const client = browserClient((await signUpUser()).cookie)

    for (let draft = 1; draft <= 3; draft++)
      await client.drafts.create({ today })

    expect(await client.drafts.list({})).toHaveLength(3)
  })
})

describe("new guests from one network", () => {
  /** Better Auth with production's real Turnstile widget. */
  async function productionAuth() {
    const db = await database()
    return createAuth({
      db,
      env: { ...env, STAGE: "production", TURNSTILE_SECRET_KEY: "0x4AAA-real" },
      waitUntil: () => {},
    })
  }

  function newGuest(auth: ReturnType<typeof createAuth>, ip: string) {
    return auth.handler(
      new Request(`${origin}/api/auth/sign-in/anonymous`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "cf-connecting-ip": ip,
          "x-captcha-response": "pass:parley.runtimedrift.dev:auth",
        },
        body: "{}",
      })
    )
  }

  it(`production lets ${GUESTS_PER_NETWORK.max} in, then asks the next to wait an hour`, async () => {
    const auth = await productionAuth()
    const ip = randomIp()

    for (let guest = 1; guest <= GUESTS_PER_NETWORK.max; guest++)
      expect((await newGuest(auth, ip)).status).toBe(200)
    const refused = await newGuest(auth, ip)

    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get("x-retry-after"))).toBeGreaterThan(
      GUESTS_PER_NETWORK.window - 60
    )
    // Another network is not held up.
    expect((await newGuest(auth, randomIp())).status).toBe(200)
  })

  it("test deployments (local, Previews) let the e2e runs through", async () => {
    const ip = randomIp()
    const newTestGuest = () =>
      call("/api/auth/sign-in/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": ip },
        body: "{}",
      })

    // Better Auth's own sign-in limit would stop the 4th.
    for (let guest = 1; guest <= 30; guest++)
      expect((await newTestGuest()).status).toBe(200)

    expect((await newTestGuest()).status).toBe(429)
  })
})
