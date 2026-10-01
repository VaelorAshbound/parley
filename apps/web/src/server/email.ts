import type { ReactElement } from "react"
import { render } from "react-email"
import { Resend } from "resend"

import { logError, logInfo, logWarn } from "./log"

// Sending email with Resend (spec §5 Auth): the verified domain
// mail.runtimedrift.dev, an idempotency key on every send, and `{ error }`
// checked, because the SDK returns errors instead of throwing.
// https://resend.com/docs/send-with-nodejs

export const FROM = "Parley <no-reply@mail.runtimedrift.dev>"

export type Email = {
  /** A stable name for logs, e.g. "verify_email". Never the address. */
  event: string
  to: string
  subject: string
  react: ReactElement
  /** `<event>/<id>`: a retry within 24 h sends nothing twice. */
  idempotencyKey: string
}

/**
 * Domains that can never receive mail (RFC 2606 and 6761): guests'
 * placeholder addresses and test sign-ups. Sending there would only bounce
 * and hurt the domain's reputation.
 */
function undeliverable(to: string) {
  const domain = to.slice(to.lastIndexOf("@") + 1).toLowerCase()
  return (
    /\.(test|example|invalid|localhost)$/.test(domain) ||
    /^example\.(com|net|org)$/.test(domain)
  )
}

/**
 * Makes the send function. Without an API key (local dev, tests) it sends
 * nothing and logs a warning. It never throws: sends run in the background
 * after the response, and a failed send is logged for on-call instead.
 */
export function createMailer(env: { RESEND_API_KEY?: string | undefined }) {
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

  return async function send(email: Email) {
    if (undeliverable(email.to)) {
      logInfo("email_skipped", { email: email.event, reason: "undeliverable" })
      return
    }
    if (!resend) {
      logWarn("email_not_configured", { email: email.event })
      return
    }
    // HTML and plain text: some people and spam filters read only the text.
    const [html, text] = await Promise.all([
      render(email.react),
      render(email.react, { plainText: true }),
    ])
    const { error } = await resend.emails.send(
      { from: FROM, to: email.to, subject: email.subject, html, text },
      { idempotencyKey: email.idempotencyKey }
    )
    if (error)
      // Resend's code and status only: its message can quote the address.
      logError("email_failed", new Error(error.name), {
        email: email.event,
        status: error.statusCode ?? 0,
        code: error.name,
      })
  }
}

export type SendEmail = ReturnType<typeof createMailer>
