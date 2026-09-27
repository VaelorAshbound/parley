import { env } from "cloudflare:workers"
import { vi } from "vitest"

import { call } from "./helpers"

// Polar's side of billing (T26). The payloads in fixtures/polar/ are real
// `customer.state_changed` bodies from the Polar sandbox (a test-card
// checkout on 2026-09-26, then cancel at period end, then revoke). A test
// puts its own user's id in `external_id`, signs the body as Polar does,
// and posts it to the webhook route.

type State = { data: { id: string; external_id: string | null } }

/**
 * A real state for this user: its `external_id` is the user's id, and its
 * customer id is the user's own (Polar makes one customer per external id).
 */
export function stateFor<T extends State>(
  fixture: T,
  userId: string | null,
  customerId = userId ? `cus-${userId}` : `cus-${crypto.randomUUID()}`
) {
  return {
    ...fixture,
    data: { ...fixture.data, id: customerId, external_id: userId },
  }
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
  return {
    calls,
    restore: () => spy.mockRestore(),
    /** Forgets the calls so far: the test's own come next. */
    forget: () => void calls.splice(0),
  }
}

type Answer = Parameters<typeof fakePolarApi>[0]

/**
 * Polar's sandbox for the billing tests: each customer's current state
 * (`GET /v1/customers/{id}/state`, what the webhook reads), plus what a
 * test answers itself (`answer`). A customer with no state is not found,
 * and so is deleting one.
 */
export function fakePolar() {
  const states = new Map<string, unknown>()
  let answer: Answer
  const api = fakePolarApi((request) => {
    const own = answer?.(request)
    if (own) return own
    const state = /^\/v1\/customers\/([^/?]+)\/state$/.exec(request.path)
    if (request.method === "GET" && state?.[1]) {
      const current = states.get(state[1])
      return current ? Response.json(current) : notFound()
    }
    // A user who never bought: Polar has no customer to delete.
    if (
      request.method === "DELETE" &&
      request.path.startsWith("/v1/customers/external/")
    )
      return notFound()
    return undefined
  })
  return {
    ...api,
    states,
    /** What the fake answers first, for this test. */
    answer: (next: Answer) => void (answer = next),
  }
}

/**
 * What Polar does when a customer's state changes: the state is current
 * in its API, then the webhook tells Parley.
 */
export async function send(
  polar: ReturnType<typeof fakePolar>,
  payload: { data: { id: string } }
) {
  polar.states.set(payload.data.id, payload.data)
  return deliver(payload)
}

function notFound() {
  return Response.json(
    { error: "ResourceNotFound", detail: "Not found" },
    { status: 404 }
  )
}
