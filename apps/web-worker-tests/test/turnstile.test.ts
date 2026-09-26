import { connect } from "@workspace/db"
import { env } from "cloudflare:workers"
import { describe, expect, it, onTestFinished } from "vitest"

import { createAuth } from "../../web/src/server/auth"
import { call } from "./helpers"

// Sign-up and sign-in need a solved Turnstile challenge (spec §5 Auth:
// Better Auth's captcha plugin), so bots can't make accounts or guess
// passwords. Siteverify is faked (test/siteverify.ts).

function newEmail() {
  return `ana-${crypto.randomUUID()}@example.test`
}

const password = "correct horse 1"

function post(path: string, body: unknown, captcha: string) {
  return call(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-captcha-response": captcha,
    },
    body: JSON.stringify(body),
  })
}

describe.each([
  ["sign-up", "/api/auth/sign-up/email", { name: "Ana", password }],
  ["sign-in", "/api/auth/sign-in/email", { password }],
  ["a new confirmation email", "/api/auth/send-verification-email", {}],
])("%s", (_, path, body) => {
  it("is refused without a Turnstile token", async () => {
    const response = await post(path, { ...body, email: newEmail() }, "")

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: "MISSING_RESPONSE",
    })
  })

  it("is refused when Turnstile rejects the token", async () => {
    const response = await post(
      path,
      { ...body, email: newEmail() },
      "a-forged-token"
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: "VERIFICATION_FAILED",
    })
  })
})

// A guest is made on the first action that needs a session (spec §2
// Limits: Turnstile once), so bots can't make guests to spend AI messages.
describe("a new guest", () => {
  it("is refused without a Turnstile token", async () => {
    const response = await post("/api/auth/sign-in/anonymous", {}, "")

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "MISSING_RESPONSE" })
  })

  it("is refused when Turnstile rejects the token", async () => {
    const response = await post("/api/auth/sign-in/anonymous", {}, "forged")

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: "VERIFICATION_FAILED",
    })
  })
})

describe("with the production widget", () => {
  /** Sign-up straight through Better Auth, with a real (non-test) secret. */
  async function signUpInProduction(captcha: string) {
    const db = await connect(env.HYPERDRIVE.connectionString)
    onTestFinished(() => db.$client.end())
    const auth = createAuth({
      db,
      env: { ...env, STAGE: "production", TURNSTILE_SECRET_KEY: "0x4AAA-real" },
      waitUntil: () => {},
    })
    return auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-captcha-response": captcha,
        },
        body: JSON.stringify({ name: "Ana", email: newEmail(), password }),
      })
    )
  }

  it("accepts a token solved on Parley's domain for signing in", async () => {
    const response = await signUpInProduction(
      "pass:parley.runtimedrift.dev:auth"
    )

    expect(response.status).toBe(200)
  })

  it("refuses a token solved on another site", async () => {
    const response = await signUpInProduction("pass:evil.example:auth")

    expect(response.status).toBe(403)
  })

  it("refuses a token solved for another action", async () => {
    const response = await signUpInProduction(
      "pass:parley.runtimedrift.dev:newsletter"
    )

    expect(response.status).toBe(403)
  })
})
