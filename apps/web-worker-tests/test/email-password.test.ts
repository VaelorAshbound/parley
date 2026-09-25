import { afterEach, describe, expect, it } from "vitest"

import { call, cookiesFrom } from "./helpers"
import { fakeResend } from "./resend"

// Email + password accounts: sign-up, the confirmation email, and Better
// Auth's limits on the auth routes (spec §5 Auth).

let resend: ReturnType<typeof fakeResend>
afterEach(() => resend?.restore())

function newEmail() {
  // A real-looking domain, so the mailer sends (to the fake Resend).
  return `ana-${crypto.randomUUID()}@acme.dev`
}

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return call(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

const password = "correct horse 1"

async function session(cookie: string) {
  const response = await call("/api/auth/get-session", {
    headers: { cookie },
  })
  return (await response.json()) as {
    user: { email: string; emailVerified: boolean }
  } | null
}

describe("sign-up", () => {
  it("signs the user in at once, with the email not yet confirmed", async () => {
    resend = fakeResend()
    const email = newEmail()

    const response = await post("/api/auth/sign-up/email", {
      name: "Ana",
      email,
      password,
    })

    expect(response.status).toBe(200)
    expect(await session(cookiesFrom(response))).toMatchObject({
      user: { email, emailVerified: false },
    })
  })

  it("sends one confirmation email from Parley's domain", async () => {
    resend = fakeResend()
    const email = newEmail()

    await post("/api/auth/sign-up/email", { name: "Ana", email, password })

    expect(resend.sent).toEqual([
      expect.objectContaining({
        from: "Parley <no-reply@mail.runtimedrift.dev>",
        to: email,
        subject: "Confirm your email for Parley",
      }),
    ])
    expect(resend.linkFor(email).pathname).toBe("/api/auth/verify-email")
  })

  it("refuses a password shorter than 10 characters", async () => {
    resend = fakeResend()

    const response = await post("/api/auth/sign-up/email", {
      name: "Ana",
      email: newEmail(),
      password: "short1",
    })

    expect(response.status).toBe(400)
    expect(resend.sent).toEqual([])
  })
})

describe("the confirmation link", () => {
  it("confirms the email and keeps the user signed in", async () => {
    resend = fakeResend()
    const email = newEmail()
    const signUp = await post("/api/auth/sign-up/email", {
      name: "Ana",
      email,
      password,
    })
    const link = resend.linkFor(email)

    const response = await call(link.pathname + link.search, {
      headers: { cookie: cookiesFrom(signUp) },
      redirect: "manual",
    })

    expect(response.status).toBe(302)
    expect(await session(cookiesFrom(response))).toMatchObject({
      user: { email, emailVerified: true },
    })
  })

  it("works on another device, with no session there", async () => {
    resend = fakeResend()
    const email = newEmail()
    await post("/api/auth/sign-up/email", { name: "Ana", email, password })
    const link = resend.linkFor(email)

    const response = await call(link.pathname + link.search, {
      redirect: "manual",
    })

    expect(response.status).toBe(302)
    expect(await session(cookiesFrom(response))).toMatchObject({
      user: { email, emailVerified: true },
    })
  })

  it("refuses a forged token", async () => {
    const response = await call(
      "/api/auth/verify-email?token=not-a-real-token",
      { redirect: "manual" }
    )

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(cookiesFrom(response)).not.toContain("session_token=")
  })
})

describe("the auth rate limits (per IP, kept in the database)", () => {
  it("allows 3 sign-in tries in 10 seconds, then answers 429", async () => {
    const ip = { "cf-connecting-ip": "203.0.113.7" }
    const body = { email: newEmail(), password: "wrong password 1" }

    const statuses = []
    for (let attempt = 0; attempt < 4; attempt++)
      statuses.push((await post("/api/auth/sign-in/email", body, ip)).status)

    expect(statuses).toEqual([401, 401, 401, 429])
  })

  it("allows 3 confirmation emails a minute, then answers 429", async () => {
    resend = fakeResend()
    const ip = { "cf-connecting-ip": "203.0.113.8" }
    const email = newEmail()
    await post("/api/auth/sign-up/email", { name: "Ana", email, password })

    const statuses = []
    for (let attempt = 0; attempt < 4; attempt++)
      statuses.push(
        (await post("/api/auth/send-verification-email", { email }, ip)).status
      )

    expect(statuses).toEqual([200, 200, 200, 429])
    // The sign-up email plus the three allowed resends.
    expect(resend.sent).toHaveLength(4)
  })

  it("limits each IP on its own", async () => {
    const body = { email: newEmail(), password: "wrong password 1" }
    for (let attempt = 0; attempt < 3; attempt++)
      await post("/api/auth/sign-in/email", body, {
        "cf-connecting-ip": "203.0.113.9",
      })

    const other = await post("/api/auth/sign-in/email", body, {
      "cf-connecting-ip": "203.0.113.10",
    })

    expect(other.status).toBe(401)
  })
})
