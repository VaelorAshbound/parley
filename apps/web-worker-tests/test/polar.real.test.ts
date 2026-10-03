import { env } from "cloudflare:workers"
import { afterAll, describe, expect, it } from "vitest"

import {
  portalWithoutCustomerAnswer,
  sendEmailToPolar,
} from "../../web/src/server/billing"

// Billing against Polar's real SANDBOX (PAR-21; CLAUDE.md: every outside
// service proven in its real sandbox). Parley's own code talks to Polar;
// the test sets up and reads back with Polar's plain REST API, so what it
// checks is what Polar stored. Every customer it makes has an external id
// starting "wave2-" and is deleted at the end. Run with
// `pnpm test:workers:real`, with the sandbox token in apps/web/.dev.vars.
// No database here, so this never touches Neon.

const token = env.POLAR_ACCESS_TOKEN
const isRealToken = Boolean(token) && !token.includes("test_only")
const api = "https://sandbox-api.polar.sh/v1"

/** Polar's REST API with the sandbox token. */
function polar(path: string, init: RequestInit = {}) {
  return fetch(`${api}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  })
}

/** Polar refuses reserved domains (example.test); Resend's test inbox it takes. */
const inbox = (externalId: string, tag = "") =>
  `delivered+${externalId}${tag}@resend.dev`

const made: string[] = []

/** A sandbox customer as checkout makes it: our user id as its external id. */
async function makeCustomer() {
  const externalId = `wave2-${crypto.randomUUID()}`
  const response = await polar("/customers/", {
    method: "POST",
    body: JSON.stringify({
      external_id: externalId,
      email: inbox(externalId),
      name: "Wave Two",
    }),
  })
  expect(response.status).toBe(201)
  const { id } = await response.json<{ id: string }>()
  made.push(id)
  return { id, externalId }
}

afterAll(async () => {
  // Only the customers this run made. One deleted by the test answers 404.
  for (const id of made) {
    const response = await polar(`/customers/${id}`, { method: "DELETE" })
    expect([204, 404]).toContain(response.status)
  }
})

describe.skipIf(!isRealToken)("billing in Polar's real sandbox", () => {
  it(
    "sends a changed email to the Polar customer",
    { timeout: 30_000 },
    async () => {
      const { externalId } = await makeCustomer()
      const newEmail = inbox(externalId, "-new")

      await sendEmailToPolar(env, { userId: externalId, email: newEmail })

      const stored = await polar(`/customers/external/${externalId}`)
      expect(stored.status).toBe(200)
      expect((await stored.json<{ email: string }>()).email).toBe(newEmail)
    }
  )

  it(
    "says NO_BILLING for a customer deleted by hand",
    { timeout: 30_000 },
    async () => {
      const { id, externalId } = await makeCustomer()
      // Still there: the portal works as usual.
      expect(await portalWithoutCustomerAnswer(env, externalId)).toBeUndefined()

      // Deleted in Polar's dashboard.
      const deleted = await polar(`/customers/${id}`, { method: "DELETE" })
      expect(deleted.status).toBe(204)

      // What the portal plugin asks for then fails (it answers 500)...
      const session = await polar("/customer-sessions/", {
        method: "POST",
        body: JSON.stringify({ external_customer_id: externalId }),
      })
      expect(session.ok).toBe(false)
      // ...and Parley answers NO_BILLING instead.
      const answer = await portalWithoutCustomerAnswer(env, externalId)
      expect(answer?.status).toBe(404)
      expect(await answer?.json()).toMatchObject({ code: "NO_BILLING" })
    }
  )
})
