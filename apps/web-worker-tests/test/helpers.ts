import { connect } from "@workspace/db"
import { env } from "cloudflare:workers"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { expect } from "vitest"

import { api } from "../../web/src/server/api"
import { createAuth } from "../../web/src/server/auth"
import { createServerClient } from "../../web/src/server/rpc/server-client"

export const origin = "http://localhost:3000"

/** One request through the real /api app, as the browser would send it. */
export async function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has("origin")) headers.set("origin", origin)
  // Every real HTTP request has one; Better Auth builds its URL from it.
  if (!headers.has("host")) headers.set("host", new URL(origin).host)
  // Each call is its own client, as far as the rate limiter can tell.
  if (!headers.has("cf-connecting-ip"))
    headers.set("cf-connecting-ip", randomIp())
  const ctx = createExecutionContext()
  const response = await api.fetch(
    new Request(origin + path, { ...init, headers }),
    env,
    ctx
  )
  await waitOnExecutionContext(ctx)
  return response
}

/** The Cookie header a browser would send back after this response. */
export function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

/** A new guest, as the first visit that needs a session makes one. */
export async function signInGuest() {
  const response = await call("/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  expect(response.status).toBe(200)
  return { cookie: cookiesFrom(response) }
}

/** Calls procedures in-process with the given cookie (or none), like SSR. */
export async function serverClient(cookie?: string) {
  const db = await connect(env.HYPERDRIVE.connectionString)
  const ctx = createExecutionContext()
  const reqHeaders = new Headers({ host: "localhost:3000" })
  if (cookie) reqHeaders.set("cookie", cookie)
  return createServerClient({
    db,
    auth: createAuth({ db, env, waitUntil: (p) => ctx.waitUntil(p) }),
    reqHeaders,
    resHeaders: new Headers(),
  })
}

function randomIp() {
  const [a = 0, b = 0, c = 0] = crypto.getRandomValues(new Uint8Array(3))
  return `10.${a}.${b}.${c}`
}
