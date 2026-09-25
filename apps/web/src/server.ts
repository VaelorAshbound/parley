import handler from "@tanstack/react-start/server-entry"

import { api } from "./server/api"
import { scheduled } from "./server/cron"

// One Worker: /api/* goes to Hono, every other path to TanStack Start SSR.
// The nightly Cron Trigger runs scheduled(): the guest cleanup (T28).
// Why a custom entry: docs/adr/0002 (T6) and work/PAR-1/spec.md §2 Architecture.
export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx)
    }
    return handler.fetch(request)
  },
  scheduled,
} satisfies ExportedHandler<Env>
