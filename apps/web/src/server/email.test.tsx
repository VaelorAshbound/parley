import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createMailer } from "./email"
import { VerifyEmail } from "@/emails/verify-email"

const link = "https://parley.runtimedrift.dev/api/auth/verify-email?token=abc"

function verifyEmail(to: string) {
  return {
    event: "verify_email",
    to,
    subject: "Confirm your email for Parley",
    react: <VerifyEmail url={link} />,
    idempotencyKey: "verify-email/user-1/abc",
  }
}

/** Resend's HTTP API, faked at the network edge. */
function fakeResend(response: Response) {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response.clone())
  return fetch
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createMailer", () => {
  it("sends through Resend from Parley's domain, with a retry-safe key", async () => {
    const fetch = fakeResend(Response.json({ id: "email-1" }))
    const send = createMailer({ RESEND_API_KEY: "re_test" })

    await send(verifyEmail("ana@acme.com"))

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe("https://api.resend.com/emails")
    const headers = new Headers(init?.headers)
    expect(headers.get("idempotency-key")).toBe("verify-email/user-1/abc")
    expect(init?.body).toBeTypeOf("string")
    const body = JSON.parse(init?.body as string)
    expect(body).toMatchObject({
      from: "Parley <no-reply@mail.runtimedrift.dev>",
      to: "ana@acme.com",
      subject: "Confirm your email for Parley",
    })
    expect(body.html).toContain(link.replaceAll("&", "&amp;"))
    // A plain-text part too, for accessibility and spam filters.
    expect(body.text).toContain(link)
  })

  it("never sends to a domain that can't receive mail", async () => {
    const fetch = fakeResend(Response.json({ id: "email-1" }))
    const send = createMailer({ RESEND_API_KEY: "re_test" })

    await send(verifyEmail("guest@anonymous.invalid"))
    await send(verifyEmail("e2e@example.test"))
    await send(verifyEmail("someone@example.com"))

    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends nothing without an API key, and says so", async () => {
    const fetch = fakeResend(Response.json({ id: "email-1" }))
    using warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const send = createMailer({ RESEND_API_KEY: "" })

    await send(verifyEmail("ana@acme.com"))

    expect(fetch).not.toHaveBeenCalled()
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      event: "email_not_configured",
      email: "verify_email",
    })
  })

  it("logs a refused send without the address or the link", async () => {
    fakeResend(
      Response.json(
        {
          name: "daily_quota_exceeded",
          message: "You have reached your daily email sending quota.",
          statusCode: 429,
        },
        { status: 429 }
      )
    )
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    const send = createMailer({ RESEND_API_KEY: "re_test" })

    await send(verifyEmail("ana@acme.com"))

    // Ours is the JSON line (the SDK adds its own outside production builds).
    const line = String(
      error.mock.calls.find(([first]) => String(first).startsWith("{"))?.[0]
    )
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      event: "email_failed",
      email: "verify_email",
      status: 429,
      code: "daily_quota_exceeded",
    })
    expect(line).not.toContain("ana@acme.com")
    expect(line).not.toContain("token=")
  })
})
