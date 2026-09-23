import { describe, expect, it } from "vite-plus/test"

import { api } from "./api"

describe("GET /api/health", () => {
  it("answers 200 with { ok: true }", async () => {
    const response = await api.request("/api/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it("answers HEAD for uptime checks without a body", async () => {
    const response = await api.request("/api/health", { method: "HEAD" })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("")
  })

  it("answers 404 for an unknown /api path", async () => {
    const response = await api.request("/api/nope")

    expect(response.status).toBe(404)
  })
})
