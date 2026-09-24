import { onError, ORPCError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import {
  RequestHeadersPlugin,
  ResponseHeadersPlugin,
  SimpleCsrfProtectionHandlerPlugin,
} from "@orpc/server/plugins"

import { logError } from "../log"
import { drafts } from "./drafts"

export const router = { drafts }
export type Router = typeof router

// Built once per isolate: it holds no request state.
export const rpcHandler = new RPCHandler(router, {
  plugins: [
    new RequestHeadersPlugin(),
    new ResponseHeadersPlugin(),
    // SameSite=Lax doesn't stop same-site pages (other workers on our
    // workers.dev subdomain) from posting a form; a custom header can't be
    // sent without CORS. The browser link adds it (SimpleCsrfProtectionLinkPlugin).
    new SimpleCsrfProtectionHandlerPlugin(),
  ],
  // Around each procedure call, where database and engine errors surface.
  clientInterceptors: [
    onError((error) => {
      // Expected outcomes (not signed in, not found, bad input) aren't errors.
      if (error instanceof ORPCError && error.status < 500) return
      logError("rpc_error", error)
    }),
  ],
})
