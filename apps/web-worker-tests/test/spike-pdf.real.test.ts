import { env } from "cloudflare:workers"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import { api } from "../../web/src/server/api"

// T2 spike: can Browser Run turn our HTML into a PDF? Real service, costs
// a few seconds of browser time, so it runs only in `pnpm test:workers:real`.
describe("GET /api/spike/pdf against real Browser Run", () => {
  it("returns a complete multi-page PDF", { timeout: 60_000 }, async () => {
    const ctx = createExecutionContext()

    const response = await api.fetch(
      new Request("https://parley.test/api/spike/pdf"),
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    const pdf = new TextDecoder("latin1").decode(await response.arrayBuffer())
    expect(pdf.startsWith("%PDF-")).toBe(true)
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true)
    const pages = pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })
})
