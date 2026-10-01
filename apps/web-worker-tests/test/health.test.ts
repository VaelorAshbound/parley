import { env } from "cloudflare:workers"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import { api } from "../../web/src/server/api"

describe("the API in workerd", () => {
  it("answers GET /api/health with { ok: true }", async () => {
    const ctx = createExecutionContext()

    const response = await api.fetch(
      new Request("https://parley.test/api/health"),
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
