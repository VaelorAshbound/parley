import { Webhook } from "standardwebhooks"
import { describe, expect, it } from "vite-plus/test"

import { verifyPolarWebhook } from "./polar-webhook"

// Polar signs webhooks with the Standard Webhooks scheme. Which key it uses
// depends on the secret's age (https://polar.sh/docs/integrate/webhooks/delivery):
// made on or after 2026-09-08, the base64 bytes after `whsec_`; before,
// the UTF-8 bytes of the whole secret.

const standard = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw7Jxx2Oll+OE="
const legacy = "polar_whs_older_secret_made_before_september"
const body = JSON.stringify({ type: "customer.state_changed", data: {} })

/** Signed as Polar does: with the Standard key, or the whole text. */
function signed(key: string | Uint8Array, at = new Date()) {
  const webhook =
    typeof key === "string"
      ? new Webhook(key)
      : new Webhook(key, { format: "raw" })
  const id = `msg_${crypto.randomUUID()}`
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
    "webhook-signature": webhook.sign(id, at, body),
  }
}

describe("verifyPolarWebhook", () => {
  it("accepts a Standard Webhooks secret, as Polar signs with it", () => {
    expect(verifyPolarWebhook(body, signed(standard), standard)).toEqual(
      JSON.parse(body)
    )
  })

  it("accepts an older secret, signed with its whole text", () => {
    const key = new TextEncoder().encode(legacy)
    expect(verifyPolarWebhook(body, signed(key), legacy)).toEqual(
      JSON.parse(body)
    )
  })

  it("accepts an older `whsec_` secret, signed with its whole text", () => {
    const key = new TextEncoder().encode(standard)
    expect(verifyPolarWebhook(body, signed(key), standard)).toEqual(
      JSON.parse(body)
    )
  })

  it("refuses a body signed with another secret", () => {
    const other = "whsec_c29tZW9uZSBlbHNlJ3Mgc2VjcmV0IGtleSBieXRlcw=="
    expect(() => verifyPolarWebhook(body, signed(other), standard)).toThrow(
      "No matching signature found"
    )
  })

  it("refuses a delivery signed long ago", () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    expect(() =>
      verifyPolarWebhook(body, signed(standard, hourAgo), standard)
    ).toThrow("Message timestamp too old")
  })

  it("refuses a body changed after it was signed", () => {
    const headers = signed(standard)
    expect(() =>
      verifyPolarWebhook(body.replace("{}", '{"x":1}'), headers, standard)
    ).toThrow("No matching signature found")
  })
})
