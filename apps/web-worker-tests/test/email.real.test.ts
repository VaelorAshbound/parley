import { env } from "cloudflare:workers"
import { describe, expect, it, vi } from "vitest"

import { VerifyEmail } from "../../web/src/emails/verify-email"
import { createMailer } from "../../web/src/server/email"

// One real send through Resend from mail.runtimedrift.dev, to Resend's
// "delivered" test inbox (no real person, no bounce). It spends one email
// of the free quota, so it runs only in `pnpm test:workers:real`, and only
// with RESEND_API_KEY set.
const key = (env as { RESEND_API_KEY?: string }).RESEND_API_KEY

describe.skipIf(!key)("the confirmation email through real Resend", () => {
  it("is accepted for sending", { timeout: 30_000 }, async () => {
    const error = vi.spyOn(console, "error")
    const send = createMailer({ RESEND_API_KEY: key })

    await send({
      event: "verify_email",
      to: "delivered+parley-t21@resend.dev",
      subject: "Confirm your email for Parley",
      // Called as a function: this package has no React of its own.
      react: VerifyEmail({
        url: "https://parley.runtimedrift.dev/api/auth/verify-email?token=real-test",
      }),
      idempotencyKey: `verify-email/real-test/${crypto.randomUUID()}`,
    })

    // The mailer logs `email_failed` (never throws) when Resend says no.
    expect(
      error.mock.calls.filter(([line]) => String(line).includes("email_failed"))
    ).toEqual([])
  })
})
