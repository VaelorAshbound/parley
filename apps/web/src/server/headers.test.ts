import { describe, expect, it } from "vite-plus/test"

import { newNonce, pageHeaders, withPageHeaders } from "./headers"

/** The CSP's directives by name, e.g. { "script-src": ["'self'", …] }. */
function directives(csp: string) {
  return Object.fromEntries(
    csp
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values])
  )
}

describe("newNonce", () => {
  it("is new each time and long enough not to be guessed", () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce))
    expect(nonces.size).toBe(100)
    // 16 random bytes, base64: 24 characters.
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })
})

describe("pageHeaders", () => {
  const csp = directives(pageHeaders("abc")["Content-Security-Policy"])

  it("runs only scripts with this response's nonce, and what they load", () => {
    expect(csp["script-src"]).toContain("'nonce-abc'")
    expect(csp["script-src"]).toContain("'strict-dynamic'")
    expect(csp["script-src"]).not.toContain("'unsafe-inline'")
    expect(csp["script-src"]).not.toContain("'unsafe-eval'")
  })

  it("keeps inline styles working (React style props, Motion)", () => {
    // A nonce in style-src would make browsers ignore 'unsafe-inline'.
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'"])
  })

  it("lets only Turnstile in from outside", () => {
    expect(csp["frame-src"]).toEqual(["https://challenges.cloudflare.com"])
    expect(csp["connect-src"]).toEqual(["'self'"])
    expect(csp["default-src"]).toEqual(["'self'"])
  })

  it("can't be framed, and blocks base, object and form tricks", () => {
    expect(csp["frame-ancestors"]).toEqual(["'none'"])
    expect(csp["base-uri"]).toEqual(["'none'"])
    expect(csp["object-src"]).toEqual(["'none'"])
    expect(csp["form-action"]).toEqual(["'self'"])
  })

  it("sets the other security headers", () => {
    const headers = pageHeaders("abc")
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains"
    )
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["X-Frame-Options"]).toBe("DENY")
    expect(headers["Permissions-Policy"]).toContain("camera=()")
  })
})

describe("withPageHeaders", () => {
  it("adds the headers to a page", async () => {
    const page = new Response("<p>hi</p>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
    const response = withPageHeaders(page, "abc")
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "'nonce-abc'"
    )
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    )
    expect(await response.text()).toBe("<p>hi</p>")
  })

  it("keeps a header the route set itself (a share page's no-referrer)", () => {
    const page = new Response("", {
      headers: { "Referrer-Policy": "no-referrer" },
    })
    const response = withPageHeaders(page, "abc")
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
  })

  it("works on a redirect, whose headers can't be changed in place", () => {
    const redirect = Response.redirect("https://parley.app/sign-in", 307)
    const response = withPageHeaders(redirect, "abc")
    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe("https://parley.app/sign-in")
    expect(response.headers.get("Strict-Transport-Security")).toBeTruthy()
  })
})
