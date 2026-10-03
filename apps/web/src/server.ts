import handler from "@tanstack/react-start/server-entry"

import { api } from "./server/api"
import { scheduled } from "./server/cron"
import { newNonce, withPageHeaders } from "./server/headers"
import { withoutConsole } from "./server/log"
import { redactShareToken } from "./server/redact"

// One Worker: /api/* goes to Hono, every other path to TanStack Start SSR.
// The nightly Cron Trigger runs scheduled(): the guest cleanup (T28).
// Why a custom entry: docs/adr/0002 (T6) and work/PAR-1/spec.md §2 Architecture.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    // Traces put url.full and url.path on this invocation's root span; a
    // share link's token must not land there (PAR-16, wrangler.jsonc).
    const redacted = redactShareToken(url)
    const span = redacted ? ctx.tracing.getActiveSpan() : undefined
    if (redacted) {
      span?.setAttributes({
        "url.full": redacted.href,
        "url.path": redacted.pathname,
      })
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx)
    }
    // Every page gets the security headers (T38), with a script nonce that
    // Start puts on its own inline scripts (router.tsx reads it).
    const cspNonce = newNonce()
    const render = () => handler.fetch(request, { context: { cspNonce } })
    // Workers Logs would put the share token (the URL) on any console line
    // (PAR-31): our events go on the trace span instead.
    const page = await (redacted ? withoutConsole(span, render) : render())
    return withPageHeaders(page, cspNonce)
  },
  scheduled,
} satisfies ExportedHandler<Env>
