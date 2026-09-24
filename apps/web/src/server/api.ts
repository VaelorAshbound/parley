import { connect } from "@workspace/db"
import { Hono, type Context } from "hono"
import { bodyLimit } from "hono/body-limit"
import { contextStorage } from "hono/context-storage"
import { HTTPException } from "hono/http-exception"
import { requestId, type RequestIdVariables } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"
import { timing, type TimingVariables } from "hono/timing"

import { createAuth } from "./auth"
import { logError } from "./log"
import { rpcHandler } from "./rpc/router"

// The /api layer (spec §5 Hono): built-in middleware only, then the sub-apps.
// Nothing here may read a request body before oRPC or Better Auth does.

type AppEnv = {
  Bindings: Env
  Variables: RequestIdVariables & TimingVariables
}

/** A database client and an auth instance for this request only. */
async function services(c: Context<AppEnv>) {
  const db = await connect(c.env.HYPERDRIVE.connectionString)
  const auth = createAuth({
    db,
    env: c.env,
    waitUntil: (promise) => c.executionCtx.waitUntil(promise),
  })
  return { db, auth }
}

// Bodies are read in full, and one isolate serves many requests: cap them
// well below the 128 MB isolate limit. Auth bodies are a few fields.
const auth = new Hono<AppEnv>()
  .use(bodyLimit({ maxSize: 16 * 1024 }))
  .on(["GET", "POST"], "/*", async (c) => {
    const { auth } = await services(c)
    return auth.handler(c.req.raw)
  })

const rpc = new Hono<AppEnv>()
  .use(bodyLimit({ maxSize: 128 * 1024 }))
  .use("/*", async (c, next) => {
    const { db, auth } = await services(c)
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/api/rpc",
      context: { db, auth },
    })
    if (matched) return c.newResponse(response.body, response)
    await next()
  })

export const api = new Hono<AppEnv>()
  .basePath("/api")
  // Cloudflare's ray id when there is one, so our logs line up with its
  // logs; never a client's X-Request-Id, which could be forged.
  .use(
    requestId({
      headerName: "",
      generator: (c) => c.req.header("cf-ray") ?? crypto.randomUUID(),
    })
  )
  .use(contextStorage())
  .use(async (c, next) => {
    // Server-Timing for DevTools on previews only; it would leak timings in
    // production.
    const stage: string = c.env.STAGE
    return stage === "preview" ? timing()(c, next) : next()
  })
  .use(secureHeaders())
  // Hono answers HEAD from the GET handler on its own.
  .get("/health", (c) => c.json({ ok: true as const }))
  .get("/version", (c) => c.json({ tag: c.env.CF_VERSION_METADATA.tag }))
  .route("/auth", auth)
  .route("/rpc", rpc)
  // Anything oRPC and Better Auth didn't turn into a response, for example
  // Hyperdrive being down: log it, and tell the client nothing internal.
  .onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    logError("api_error", error)
    return c.json({ error: "Something went wrong. Please try again." }, 500)
  })

export type Api = typeof api

// The default export makes this module a Worker entry for the workerd tests.
export default api
