import { Webhook } from "standardwebhooks"

// Polar's webhook signatures (T26). Polar signs with the Standard Webhooks
// scheme, and the key depends on the secret's age
// (https://polar.sh/docs/integrate/webhooks/delivery): secrets made on or
// after 2026-09-08 are real Standard Webhooks secrets (the key is the base64
// after `whsec_`); older ones use the UTF-8 bytes of the whole secret.
// Polar's own newer SDKs try both keys, and so does this. The 0.x SDK that
// @polar-sh/better-auth needs knows only the older key, so every delivery
// to a new endpoint failed its check (seen in the real sandbox run).

/** The ways a secret may sign: the Standard one first. */
function verifiersOf(secret: string) {
  const whole = new Webhook(new TextEncoder().encode(secret), { format: "raw" })
  return secret.startsWith("whsec_") ? [new Webhook(secret), whole] : [whole]
}

/**
 * The webhook's JSON body, once its signature, id and time (5 minutes at
 * most) are checked. Throws when no key matches.
 */
export function verifyPolarWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string
): unknown {
  let failure: unknown
  for (const webhook of verifiersOf(secret)) {
    try {
      return webhook.verify(body, headers)
    } catch (error) {
      failure = error
    }
  }
  throw failure
}
