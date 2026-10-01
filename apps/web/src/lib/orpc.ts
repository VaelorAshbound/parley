import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins"
import type { RouterClient } from "@orpc/server"
import { createRouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createIsomorphicFn } from "@tanstack/react-start"
import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server"

import { requestServices } from "@/server/request-services"
import { router, type Router } from "@/server/rpc/router"

// During SSR, procedures run in this process with the page request's cookies
// (no HTTP to our own Worker); in the browser, over /api/rpc.
// https://orpc.dev/docs/adapters/tanstack-start#optimize-ssr
const createClient = createIsomorphicFn()
  .server((): RouterClient<Router> => {
    // This client is made per page request (getRouter runs per request).
    const resHeaders = new Headers()
    return createRouterClient(router, {
      context: async () => {
        const services = await requestServices()
        return { ...services, reqHeaders: getRequestHeaders(), resHeaders }
      },
      interceptors: [
        async (options) => {
          try {
            return await options.next()
          } finally {
            // Refreshed session cookies reach the browser with the page.
            const cookies = resHeaders.getSetCookie()
            if (cookies.length > 0) setResponseHeader("set-cookie", cookies)
          }
        },
      ],
    })
  })
  .client((): RouterClient<Router> =>
    createORPCClient(
      new RPCLink({
        url: `${window.location.origin}/api/rpc`,
        plugins: [new SimpleCsrfProtectionLinkPlugin()],
      })
    )
  )

export function createOrpc() {
  return createTanstackQueryUtils(createClient())
}

export type Orpc = ReturnType<typeof createOrpc>
