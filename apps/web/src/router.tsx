import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { createOrpc } from "@/lib/orpc"

import { routeTree } from "./routeTree.gen"

// Made per request on the server and once in the browser, so the query
// cache and the oRPC client are never shared between users.
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30 * 1000 } },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, orpc: createOrpc() },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Caching belongs to TanStack Query (spec §5 Routing).
    defaultPreloadStaleTime: 0,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
