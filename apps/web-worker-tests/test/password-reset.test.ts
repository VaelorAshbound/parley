import { connect, schema } from "@workspace/db"
import { eq } from "drizzle-orm"
import { env } from "cloudflare:workers"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"

import { call, cookiesFrom } from "./helpers"
import { fakeResend } from "./resend"

// "Forgot password?" (spec §5 Auth, T23): a single-use link that works for
// 30 minutes and signs every device out. The link carries its token in the
// query, never in the path: Cloudflare's invocation log keeps full paths
// (ADR-0005).

let resend: ReturnType<typeof fakeResend>
afterEach(() => resend?.restore())

const password = "correct horse 1"
const newPassword = "battery staple 2"

function newEmail() {
  // A real-looking domain, so the mailer sends (to the fake Resend).
  return `ana-${crypto.randomUUID()}@acme.dev`
}

function post(path: string, body: unknown, cookie?: string) {
  return call(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify(body),
  })
}

async function database() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  return db
}

/** Signs up (the confirmation email goes to the fake Resend too). */
async function signUp(email: string) {
  const response = await post("/api/auth/sign-up/email", {
    name: "Ana",
    email,
    password,
  })
  expect(response.status).toBe(200)
  const { user } = await response.json<{ user: { id: string } }>()
  return { userId: user.id, cookie: cookiesFrom(response) }
}

async function requestReset(email: string) {
  return post("/api/auth/request-password-reset", {
    email,
    redirectTo: "/reset-password",
  })
}

/** The reset link in the last email to this address. */
function resetLink(to: string) {
  const email = resend.sent.findLast(
    (each) => each.to === to && each.subject.includes("password")
  )
  const link = email?.text.match(/https?:\/\/\S+reset-password\S*/)?.[0]
  if (!link) throw new Error(`No reset link sent to ${to}`)
  return new URL(link)
}

async function session(cookie: string) {
  const response = await call("/api/auth/get-session?disableCookieCache=true", {
    headers: { cookie },
  })
  return response.json<{ user: { emailVerified: boolean } } | null>()
}

describe("asking for a reset link", () => {
  it("emails a link to Parley's page with the token in the query", async () => {
    resend = fakeResend()
    const email = newEmail()
    await signUp(email)

    const response = await requestReset(email)

    expect(response.status).toBe(200)
    const link = resetLink(email)
    expect(link.pathname).toBe("/reset-password")
    expect(link.searchParams.get("token")).toMatch(/^\w{20,}$/)
    expect(resend.sent.at(-1)).toMatchObject({
      from: "Parley <no-reply@mail.runtimedrift.dev>",
      subject: "Reset your Parley password",
    })
  })

  it("makes the link work for 30 minutes", async () => {
    resend = fakeResend()
    const email = newEmail()
    const { userId } = await signUp(email)

    await requestReset(email)

    const db = await database()
    const [row] = await db
      .select({ expiresAt: schema.verification.expiresAt })
      .from(schema.verification)
      .where(eq(schema.verification.value, userId))
    const minutes = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(29)
    expect(minutes).toBeLessThanOrEqual(30)
  })

  it("answers the same for an address with no account, and sends nothing", async () => {
    resend = fakeResend()

    const response = await requestReset(newEmail())

    expect(response.status).toBe(200)
    expect(resend.sent).toEqual([])
  })
})

describe("setting a new password with the link", () => {
  async function resetFlow() {
    resend = fakeResend()
    const email = newEmail()
    const account = await signUp(email)
    await requestReset(email)
    const token = resetLink(email).searchParams.get("token") ?? ""
    return { email, token, ...account }
  }

  it("changes the password, and signs every device out", async () => {
    const { email, token, cookie } = await resetFlow()

    const response = await post("/api/auth/reset-password", {
      token,
      newPassword,
    })

    expect(response.status).toBe(200)
    expect(await session(cookie)).toBeNull()
    const old = await post("/api/auth/sign-in/email", { email, password })
    expect(old.status).toBe(401)
    const fresh = await post("/api/auth/sign-in/email", {
      email,
      password: newPassword,
    })
    expect(fresh.status).toBe(200)
  })

  it("works once", async () => {
    const { token } = await resetFlow()
    await post("/api/auth/reset-password", { token, newPassword })

    const again = await post("/api/auth/reset-password", {
      token,
      newPassword: "another one 3",
    })

    expect(again.status).toBe(400)
  })

  it("stops working after 30 minutes", async () => {
    const { token, userId } = await resetFlow()
    const db = await database()
    await db
      .update(schema.verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.verification.value, userId))

    const response = await post("/api/auth/reset-password", {
      token,
      newPassword,
    })

    expect(response.status).toBe(400)
  })

  it("confirms the email: only its owner could open the link", async () => {
    const { email, token } = await resetFlow()

    await post("/api/auth/reset-password", { token, newPassword })

    const signIn = await post("/api/auth/sign-in/email", {
      email,
      password: newPassword,
    })
    expect(await session(cookiesFrom(signIn))).toMatchObject({
      user: { emailVerified: true },
    })
  })

  it("writes an audit line with the user's id only", async () => {
    const { token, userId } = await resetFlow()
    using info = vi.spyOn(console, "log").mockImplementation(() => {})

    await post("/api/auth/reset-password", { token, newPassword })

    const lines = info.mock.calls.map(([line]) => line as { event?: string })
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "password_reset", userId })
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain(token)
  })
})

// Someone signed up with an address that isn't theirs and never confirmed
// it. The real owner gets the account back through "Forgot password?": the
// link goes to their inbox, and the other person's sessions end.
it("gives an unconfirmed address back to the owner of its inbox", async () => {
  resend = fakeResend()
  const email = newEmail()
  const squatter = await signUp(email)

  await requestReset(email)
  const token = resetLink(email).searchParams.get("token") ?? ""
  await post("/api/auth/reset-password", { token, newPassword })

  expect(await session(squatter.cookie)).toBeNull()
  const owner = await post("/api/auth/sign-in/email", {
    email,
    password: newPassword,
  })
  expect(owner.status).toBe(200)
})
