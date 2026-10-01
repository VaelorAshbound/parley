import handler from "@tanstack/react-start/server-entry"
import { describe, expect, it, vi } from "vite-plus/test"

import worker from "./server"
import { scheduled } from "./server/cron"

// The Start server entry is a virtual module only the TanStack Start plugin
// can build; this test is about the Worker's handlers, not SSR.
vi.mock(import("@tanstack/react-start/server-entry"), () => ({
  default: {
    fetch: vi.fn<typeof handler.fetch>(() => new Response("<p>page</p>")),
  },
}))

describe("the Worker entry", () => {
  it("runs the nightly purge on the Cron Trigger", () => {
    // Without it, production silently stops purging: `satisfies
    // ExportedHandler` allows a missing handler, and Previews never run crons.
    expect(worker.scheduled).toBe(scheduled)
  })

  it("keeps a share token out of the trace's root span", async () => {
    // Workers traces record url.full and url.path on the fetch handler's
    // span; /s/:token would put the bearer token there (PAR-16).
    const setAttributes = vi.fn<(attributes: Record<string, string>) => void>()
    const ctx = {
      tracing: { getActiveSpan: () => ({ setAttributes }) },
    } as unknown as ExecutionContext
    await worker.fetch(
      new Request("https://parley.app/s/secret-token") as Parameters<
        typeof worker.fetch
      >[0],
      {} as Env,
      ctx
    )
    expect(setAttributes).toHaveBeenCalledWith({
      "url.full": "https://parley.app/s/:token",
      "url.path": "/s/:token",
    })
  })

  it("gives each page a new nonce, in Start's context and in its CSP", async () => {
    const start = vi.mocked(handler.fetch)
    const nonces = []
    for (let visit = 0; visit < 2; visit += 1) {
      const response = await worker.fetch(
        new Request("https://parley.app/") as Parameters<
          typeof worker.fetch
        >[0],
        {} as Env,
        noTracing
      )
      const [, options] = start.mock.lastCall ?? []
      const nonce = options?.context.cspNonce
      expect(nonce).toBeTruthy()
      expect(response.headers.get("Content-Security-Policy")).toContain(
        `'nonce-${nonce}'`
      )
      nonces.push(nonce)
    }
    expect(nonces[0]).not.toBe(nonces[1])
  })
})

const noTracing = {
  tracing: { getActiveSpan: () => undefined },
} as unknown as ExecutionContext
