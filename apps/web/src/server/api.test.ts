import { describe, expect, it, vi } from "vite-plus/test"

import { api } from "./api"

// Only what these routes read; the database routes run in workerd
// (apps/web-worker-tests).
const env = { STAGE: "production" }

describe("GET /api/health", () => {
  it("answers 200 with { ok: true }", async () => {
    const response = await api.request("/api/health", {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it("answers HEAD for uptime checks without a body", async () => {
    const response = await api.request("/api/health", { method: "HEAD" }, env)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("")
  })

  it("sends the security headers", async () => {
    const response = await api.request("/api/health", {}, env)

    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("server-timing")).toBeNull()
  })

  it("adds Server-Timing on previews only", async () => {
    const response = await api.request("/api/health", {}, { STAGE: "preview" })

    expect(response.headers.get("server-timing")).not.toBeNull()
  })

  it("answers 404 for an unknown /api path", async () => {
    const response = await api.request("/api/nope", {}, env)

    expect(response.status).toBe(404)
  })
})

describe("GET /api/version", () => {
  it("names the deployed version, so CI can wait for the right one", async () => {
    const response = await api.request(
      "/api/version",
      {},
      {
        ...env,
        COMMIT_SHA: "35a7e8b",
      }
    )

    expect(await response.json()).toEqual({ commit: "35a7e8b" })
  })
})

describe("an error outside oRPC and Better Auth", () => {
  // Nothing listens on port 1, so connecting fails, as when Hyperdrive is down.
  const broken = {
    STAGE: "production",
    HYPERDRIVE: { connectionString: "postgres://parley@127.0.0.1:1/parley" },
  }

  it("is logged, and the client gets a plain message", async () => {
    using logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await api.request(
      "/api/rpc/drafts/get",
      { method: "POST", headers: { "x-request-id": "forged-id" } },
      broken,
      { waitUntil: () => {}, passThroughOnException: () => {}, props: {} }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    })
    const line = logged.mock.calls[0]?.[0]
    expect(line).toMatchObject({ level: "error", event: "api_error" })
    // A client can't choose the id its request is logged under.
    expect(line.requestId).not.toBe("forged-id")
  })
})
