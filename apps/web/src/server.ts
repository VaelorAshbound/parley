import handler from "@tanstack/react-start/server-entry"

import { api } from "./server/api"
import { scheduled } from "./server/cron"
import { redactShareToken } from "./server/redact"

// One Worker: /api/* goes to Hono, every other path to TanStack Start SSR.
// The nightly Cron Trigger runs scheduled(): the guest cleanup (T28).
// Why a custom entry: docs/adr/0002 (T6) and work/PAR-1/spec.md §2 Architecture.
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    // Traces put url.full and url.path on this invocation's root span; a
    // share link's token must not land there (PAR-16, wrangler.jsonc).
    const redacted = redactShareToken(url)
    if (redacted) {
      ctx.tracing.getActiveSpan()?.setAttributes({
        "url.full": redacted.href,
        "url.path": redacted.pathname,
      })
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx)
    }
    return handler.fetch(request)
  },
  scheduled,
} satisfies ExportedHandler<Env>
