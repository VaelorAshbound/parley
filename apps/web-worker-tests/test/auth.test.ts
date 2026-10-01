import { describe, expect, it } from "vitest"

import { call, signInGuest } from "./helpers"

describe("guest sessions", () => {
  it("signs a guest in with a secure, http-only session cookie", async () => {
    const response = await call("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })

    expect(response.status).toBe(200)
    const cookie = response.headers
      .getSetCookie()
      .find((each) => each.includes("session_token"))
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it("knows the guest on the next request", async () => {
    const { cookie } = await signInGuest()

    const response = await call("/api/auth/get-session", {
      headers: { cookie },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      user: { isAnonymous: true },
    })
  })

  it("has no session without the cookie", async () => {
    const response = await call("/api/auth/get-session")

    expect(await response.json()).toBeNull()
  })

  it("refuses a cookie-carrying request from another site (CSRF)", async () => {
    const { cookie } = await signInGuest()

    const response = await call("/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: "{}",
    })

    expect(response.status).toBe(403)
    const session = await call("/api/auth/get-session", { headers: { cookie } })
    expect(await session.json()).toMatchObject({ user: { isAnonymous: true } })
  })

  it("refuses a host it doesn't serve", async () => {
    const response = await call("/api/auth/get-session", {
      headers: { host: "evil.example" },
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
