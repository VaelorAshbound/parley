import { describe, expect, test, vi } from "vite-plus/test"

import { GuestSignInError, signInGuest } from "./auth-client"

// Starting a guest session (spec §2 Limits): a Turnstile token per try, and
// plain reasons when it can't start. The server is faked at fetch, before
// the auth client is made (it keeps the fetch it finds).

const server = vi.hoisted(() => {
  const state = { responses: [] as Response[], sent: [] as Headers[] }
  globalThis.fetch = async (input, init) => {
    state.sent.push(
      new Headers(input instanceof Request ? input.headers : init?.headers)
    )
    return state.responses.shift() ?? Response.json({}, { status: 500 })
  }
  return state
})

function answers(...responses: Response[]) {
  server.responses = responses
  server.sent = []
  return server.sent
}

const ok = () =>
  Response.json({ token: "t", user: { id: "guest", isAnonymous: true } })
const busy = (seconds: number) =>
  Response.json(
    { message: "Too many requests. Please try again later." },
    { status: 429, headers: { "X-Retry-After": String(seconds) } }
  )

function tokens() {
  let issued = 0
  return vi.fn<() => Promise<Record<string, string>>>(async () => ({
    "x-captcha-response": `token-${++issued}`,
  }))
}

describe("signInGuest", () => {
  test("sends a Turnstile token with the sign-in", async () => {
    const sent = answers(ok())

    await signInGuest(tokens())

    expect(sent[0]?.get("x-captcha-response")).toBe("token-1")
  })

  test("waits out a short limit and tries again with a new token", async () => {
    const sent = answers(busy(1), ok())

    await signInGuest(tokens())

    expect(sent.map((each) => each.get("x-captcha-response"))).toEqual([
      "token-1",
      "token-2",
    ])
  })

  test("says the network is busy when the wait is long", async () => {
    answers(busy(3600))

    await expect(signInGuest(tokens())).rejects.toEqual(
      new GuestSignInError("busy")
    )
  })

  test("says the person check failed when there is no token", async () => {
    const sent = answers(ok())

    await expect(signInGuest(async () => undefined)).rejects.toMatchObject({
      reason: "human-check",
    })
    expect(sent).toHaveLength(0)
  })

  test("says the person check failed when the server refuses the token", async () => {
    answers(
      Response.json(
        { code: "VERIFICATION_FAILED", message: "Captcha verification failed" },
        { status: 403 }
      )
    )

    await expect(signInGuest(tokens())).rejects.toMatchObject({
      reason: "human-check",
    })
  })
})
