import { env } from "cloudflare:workers"
import { describe, expect, it, vi } from "vitest"

import { ChangeEmail } from "../../web/src/emails/change-email"
import { ResetPassword } from "../../web/src/emails/reset-password"
import { VerifyEmail } from "../../web/src/emails/verify-email"
import { createMailer } from "../../web/src/server/email"

// Real sends through Resend from mail.runtimedrift.dev, to Resend's
// "delivered" test inbox (no real person, no bounce), one per template. Each
// spends one email of the free quota, so they run only in
// `pnpm test:workers:real`, and only with RESEND_API_KEY set.
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

describe.skipIf(!key)("the account emails through real Resend", () => {
  const send = createMailer({ RESEND_API_KEY: key })

  it("accepts the password reset email", { timeout: 30_000 }, async () => {
    const error = vi.spyOn(console, "error")

    await send({
      event: "reset_password",
      to: "delivered+parley-t23@resend.dev",
      subject: "Reset your Parley password",
      react: ResetPassword({
        url: "https://parley.runtimedrift.dev/reset-password?token=real-test",
      }),
      idempotencyKey: `reset-password/real-test/${crypto.randomUUID()}`,
    })

    expect(
      error.mock.calls.filter(([line]) => String(line).includes("email_failed"))
    ).toEqual([])
  })

  it("accepts the change-email approval", { timeout: 30_000 }, async () => {
    const error = vi.spyOn(console, "error")

    await send({
      event: "change_email",
      to: "delivered+parley-t23@resend.dev",
      subject: "Approve your new email for Parley",
      react: ChangeEmail({
        url: "https://parley.runtimedrift.dev/api/auth/verify-email?token=real-test",
        newEmail: "new-address@example.com",
      }),
      idempotencyKey: `change-email/real-test/${crypto.randomUUID()}`,
    })

    expect(
      error.mock.calls.filter(([line]) => String(line).includes("email_failed"))
    ).toEqual([])
  })
})
