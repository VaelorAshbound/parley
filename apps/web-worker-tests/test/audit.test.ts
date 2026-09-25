import { describe, expect, it, vi } from "vitest"

import { call, cookiesFrom } from "./helpers"

// Audit lines (spec §5 Auth, T23): who signed in, out, and changed what,
// written by Better Auth's databaseHooks. IDs only: never an email, a name,
// a password or a token.

const auditEvents = new Set([
  "session_created",
  "session_ended",
  "login_method_added",
  "email_changed",
  "password_changed",
  "password_reset",
  "user_deleted",
])

/** The audit lines written while `run` runs, and all console text. */
async function audited<T>(run: () => Promise<T>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  using warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  using error = vi.spyOn(console, "error").mockImplementation(() => {})
  const result = await run()
  const calls = [info, warn, error].flatMap((spy) => spy.mock.calls)
  const lines = calls
    .map(([line]) => line as Record<string, unknown>)
    .filter((line) => auditEvents.has(String(line.event)))
  return { result, lines, text: JSON.stringify(calls) }
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

const password = "correct horse 1"

describe("audit lines", () => {
  it("record a sign-up's session and login method, by id only", async () => {
    const email = `ana-${crypto.randomUUID()}@example.test`

    const { result, lines, text } = await audited(() =>
      post("/api/auth/sign-up/email", { name: "Ana Secret", email, password })
    )

    const { user, token } = await result.json<{
      user: { id: string }
      token: string
    }>()
    expect(lines).toEqual([
      {
        level: "info",
        event: "login_method_added",
        requestId: expect.any(String),
        userId: user.id,
        method: "credential",
      },
      {
        level: "info",
        event: "session_created",
        requestId: expect.any(String),
        userId: user.id,
        sessionId: expect.any(String),
      },
    ])
    expect(text).not.toContain(email)
    expect(text).not.toContain("Ana Secret")
    expect(text).not.toContain(password)
    expect(text).not.toContain(token)
  })

  it("record the end of a session on sign-out", async () => {
    const email = `ana-${crypto.randomUUID()}@example.test`
    const signUp = await post("/api/auth/sign-up/email", {
      name: "Ana",
      email,
      password,
    })
    const { user } = await signUp.json<{ user: { id: string } }>()

    const { lines } = await audited(() =>
      post("/api/auth/sign-out", {}, cookiesFrom(signUp))
    )

    expect(lines).toEqual([
      expect.objectContaining({
        event: "session_ended",
        userId: user.id,
        sessionId: expect.any(String),
      }),
    ])
  })
})
