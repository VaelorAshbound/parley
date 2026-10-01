import { createRouterClient } from "@orpc/server"

import type { BaseContext } from "./base"
import { router } from "./router"

/**
 * Calls procedures in the same process, with the caller's request headers
 * (cookies). SSR loaders use it instead of HTTP to our own Worker (oRPC
 * "Optimizing SSR"); the auth-matrix tests use it too. The caller copies
 * `resHeaders` (refreshed session cookies) onto its own response.
 */
export function createServerClient(
  context: BaseContext & { reqHeaders: Headers; resHeaders: Headers }
) {
  return createRouterClient(router, { context })
}
