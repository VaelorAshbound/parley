import { env } from "cloudflare:workers"
import { vi } from "vitest"

import { call } from "./helpers"

// Polar's side of billing (T26). The payloads in fixtures/polar/ are real
// `customer.state_changed` bodies from the Polar sandbox (a test-card
// checkout on 2026-09-26, then cancel at period end, then revoke). A test
// puts its own user's id in `external_id`, signs the body as Polar does,
// and posts it to the webhook route.

type State = { data: { external_id: string | null } }

/** A real state for this user: its `external_id` is the user's id. */
export function stateFor<T extends State>(fixture: T, userId: string | null) {
  return { ...fixture, data: { ...fixture.data, external_id: userId } }
}

/**
 * Signs a body the way Polar does (Standard Webhooks: HMAC-SHA256 over
 * "id.timestamp.body", keyed with the secret's bytes), independently of the
 * SDK the app verifies with.
 */
export async function sign(
  body: string,
  {
    id = `msg_${crypto.randomUUID()}`,
    secret = env.POLAR_WEBHOOK_SECRET,
    timestamp = Math.floor(Date.now() / 1000),
  } = {}
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  )
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  }
}

/** Posts a webhook as Polar does: no cookie, no origin, JSON body. */
export async function deliver(
  payload: unknown,
  headers?: Record<string, string>
) {
  const body = JSON.stringify(payload)
  return call("/api/auth/polar/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Polar's servers send no Origin; the helper adds one unless set.
      origin: "",
      ...(headers ?? (await sign(body))),
    },
    body,
  })
}

/**
 * Fakes Polar's sandbox API for one test and records each call. Every
 * other request still goes out as usual.
 */
export function fakePolarApi(
  answer: (request: {
    method: string
    path: string
    body: unknown
  }) => Response | undefined = () => undefined
) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const realFetch = globalThis.fetch
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.origin !== "https://sandbox-api.polar.sh")
        return realFetch(input, init)
      const text = await request.text()
      const each = {
        method: request.method,
        path: url.pathname + url.search,
        body: text ? JSON.parse(text) : undefined,
      }
      calls.push(each)
      return (
        answer(each) ?? Response.json({ detail: "Not faked" }, { status: 500 })
      )
    })
  return { calls, restore: () => spy.mockRestore() }
}
