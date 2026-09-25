import { safe } from "@orpc/client"
import { createRouterClient, ORPCError } from "@orpc/server"
import { connect } from "@workspace/db"
import { env } from "cloudflare:workers"
import { afterEach, describe, expect, it, onTestFinished } from "vitest"

import { createAuth } from "../../web/src/server/auth"
import { verified } from "../../web/src/server/rpc/base"
import { call, cookiesFrom, scriptedModel, signInGuest } from "./helpers"
import { fakeResend } from "./resend"

// Export, share and upgrade need a confirmed email (spec §2 Limits). They
// come in T24–T26 and build on `verified`; this probe stands in for them.

const probe = { export: verified.handler(({ context }) => context.user.id) }

async function probeClient(cookie?: string) {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  const reqHeaders = new Headers({ host: "localhost:3000" })
  if (cookie) reqHeaders.set("cookie", cookie)
  const resHeaders = new Headers()
  const client = createRouterClient(probe, {
    context: {
      db,
      auth: createAuth({ db, env, waitUntil: () => {} }),
      model: scriptedModel([]),
      waitUntil: () => {},
      reqHeaders,
      resHeaders,
    },
  })
  return { client, resHeaders }
}

async function outcome(cookie?: string) {
  const { client } = await probeClient(cookie)
  const { error } = await safe(client.export())
  return error === null ? "OK" : error instanceof ORPCError ? error.code : error
}

let resend: ReturnType<typeof fakeResend>
afterEach(() => resend?.restore())

async function signUp() {
  resend = fakeResend()
  const email = `ana-${crypto.randomUUID()}@acme.dev`
  const response = await call("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ana", email, password: "correct horse 1" }),
  })
  return { cookie: cookiesFrom(response), link: resend.linkFor(email) }
}

async function open(link: URL, cookie?: string) {
  return call(link.pathname + link.search, {
    redirect: "manual",
    ...(cookie && { headers: { cookie } }),
  })
}

describe("a procedure that needs a confirmed email", () => {
  it("asks nobody to sign in", async () => {
    expect(await outcome()).toBe("UNAUTHORIZED")
  })

  it("asks a guest to sign in", async () => {
    expect(await outcome((await signInGuest()).cookie)).toBe("UNAUTHORIZED")
  })

  it("asks a new account to confirm its email", async () => {
    const { cookie } = await signUp()

    expect(await outcome(cookie)).toBe("EMAIL_NOT_VERIFIED")
  })

  it("lets the account in once the email is confirmed", async () => {
    const { cookie, link } = await signUp()

    await open(link, cookie)

    expect(await outcome(cookie)).toBe("OK")
  })

  it("knows at once when the email was confirmed on another device", async () => {
    const { cookie, link } = await signUp()
    // The session cookie still caches "not confirmed" for up to 5 minutes.
    expect(await outcome(cookie)).toBe("EMAIL_NOT_VERIFIED")

    await open(link)

    expect(await outcome(cookie)).toBe("OK")
  })

  it("sends the refreshed session cookie back to the browser", async () => {
    const { cookie, link } = await signUp()
    await open(link)
    const { client, resHeaders } = await probeClient(cookie)

    await client.export()

    expect(resHeaders.getSetCookie().join()).toContain("session_data")
  })
})
