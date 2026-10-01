import { createMiddleware } from "hono/factory"
import { routePath } from "hono/route"

import { logInfo, type LogVariables } from "./log"

/**
 * One line per /api request (T29): its id, method, route, status and
 * latency, plus what the handlers `annotate` (the user's tier, the
 * procedure). The route is the matched pattern ("/api/auth/*"), never the
 * path: Better Auth puts tokens in some paths, and never the query.
 *
 * `latencyMs` is the time to the response headers. A chat reply streams on
 * after that; its own `chat_turn` line has the time to first token and the
 * whole turn.
 *
 * Runs after `requestId()` and `contextStorage()`.
 */
export const requestLog = createMiddleware<{ Variables: LogVariables }>(
  async (c, next) => {
    // Workers' clock moves on I/O, which is what a request waits on.
    // https://developers.cloudflare.com/workers/reference/security-model/#step-1-disallow-timers-and-multi-threading
    const start = Date.now()
    await next()
    logInfo("request", {
      method: c.req.method,
      route: routePath(c, -1),
      status: c.res.status,
      latencyMs: Date.now() - start,
      ...c.var.logFields,
    })
  }
)
