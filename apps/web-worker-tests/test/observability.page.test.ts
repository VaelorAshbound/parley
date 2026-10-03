import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { env, exports, tracing, withEnv } from "cloudflare:workers"
import { describe, expect, it, vi } from "vitest"

import worker from "../../web/src/server"
import { RATE_LIMITS } from "../../web/src/server/limits"
import { browserClient, roomInWindow, signUpVerified } from "./helpers"

// PAR-31: Workers Logs puts the request's full URL on every console line
// the request writes, and on /s/:token the URL holds the link's token (a
// bearer secret). So a share page writes nothing to the console: not when
// it shows the document, not on a bad link, not past the limit, not when
// it breaks.

const today = "2026-09-25"
const unknown = "AAAAAAAAAAAAAAAAAAAAAA"
const { limit, period } = RATE_LIMITS.SHARE_RATE_LIMITER

const levels = ["log", "info", "warn", "error", "debug", "trace"] as const

/** Everything written to the console while `run` runs, and its result. */
async function captured<T>(run: () => Promise<T>) {
  const spies = levels.map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {})
  )
  try {
    const result = await run()
    return { result, calls: spies.flatMap((spy) => spy.mock.calls) }
  } finally {
    for (const spy of spies) spy.mockRestore()
  }
}

/** A page load from `ip`, through the real Worker. */
async function open(path: string, ip: string) {
  const response = await exports.default.fetch(`http://localhost:3000${path}`, {
    headers: { "cf-connecting-ip": ip },
  })
  return { status: response.status, html: await response.text() }
}

async function sharedLink() {
  const owner = browserClient((await signUpVerified()).cookie)
  const draft = await owner.drafts.create({ documentId: "mutual-nda", today })
  const { token } = await owner.share.create({ id: draft.id })
  return token
}

/**
 * The Worker's env with a database that refuses to connect (a wrong
 * password), so share.view throws a plain error, not a typed one.
 */
function brokenDatabase(): Env {
  const url = new URL(env.HYPERDRIVE.connectionString)
  url.password = "wrong-password"
  const hyperdrive: Hyperdrive = Object.create(env.HYPERDRIVE, {
    connectionString: { value: url.toString() },
  })
  return { ...env, HYPERDRIVE: hyperdrive }
}

describe("a share page writes nothing to the console", () => {
  it("when it shows the document", async () => {
    const token = await sharedLink()

    const { result: page, calls } = await captured(() =>
      open(`/s/${token}`, "198.51.100.41")
    )

    expect(page.status).toBe(200)
    expect(calls).toEqual([])
  })

  it("when the link doesn't work", async () => {
    const { result: page, calls } = await captured(() =>
      open(`/s/${unknown}`, "198.51.100.42")
    )

    expect(page.status).toBe(404)
    expect(calls).toEqual([])
  })

  it("past the limit", { timeout: (period + 60) * 1000 }, async () => {
    const token = await sharedLink()
    await roomInWindow(period, 30_000)
    for (let view = 0; view < limit; view += 1)
      await open(`/s/${unknown}`, "198.51.100.43")

    const { result: page, calls } = await captured(() =>
      open(`/s/${token}`, "198.51.100.43")
    )

    expect(page.status).toBe(429)
    expect(calls).toEqual([])
  })

  it("when it breaks", async () => {
    const token = await sharedLink()
    // The Worker's own context has tracing (src/server.ts uses it).
    const ctx = Object.assign(createExecutionContext(), { tracing })

    const { result: page, calls } = await captured(
      () =>
        withEnv(brokenDatabase(), async () => {
          const response = await worker.fetch(
            new Request(`http://localhost:3000/s/${token}`, {
              headers: { "cf-connecting-ip": "198.51.100.44" },
            }) as Parameters<typeof worker.fetch>[0],
            env,
            ctx
          )
          await waitOnExecutionContext(ctx)
          return { status: response.status, html: await response.text() }
        }) as Promise<{ status: number; html: string }>
    )

    expect(page.status).toBe(500)
    expect(calls).toEqual([])
  })
})
