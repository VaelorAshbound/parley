// First: Zod must be jitless before any route builds a schema (CSP, T38).
import "@/lib/zod"

import { QueryClient } from "@tanstack/react-query"
import {
  createRouter as createTanStackRouter,
  type Register,
} from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import {
  createIsomorphicFn,
  getGlobalStartContext,
} from "@tanstack/react-start"

import { createOrpc } from "@/lib/orpc"

import { routeTree } from "./routeTree.gen"

/** This page response's CSP nonce, from the Worker entry (src/server.ts). */
const cspNonce = createIsomorphicFn()
  // Typed by hand: Register's own `router` (this file) makes the inferred
  // context circular, and TypeScript gives up with `never`.
  .server(() => (getGlobalStartContext() as StartContext | undefined)?.cspNonce)
  .client(() => undefined)

type StartContext = Register["server"]["requestContext"]

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
    // Start puts it on its inline scripts and in a csp-nonce meta tag, where
    // the browser's router reads it back (src/server/headers.ts, T38).
    ssr: { nonce: cspNonce() },
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
    /** What the Worker entry passes to Start with each page (src/server.ts). */
    server: { requestContext: { cspNonce: string } }
  }
  interface StaticDataRouteOption {
    /** The page ends with the site footer, outside <main> (routes/_app). */
    footer?: boolean
  }
}
