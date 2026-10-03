import { describe, expect, it } from "vite-plus/test"

import { redactShareToken } from "./redact"

describe("redactShareToken", () => {
  it("replaces the token in /s/:token", () => {
    const url = redactShareToken(new URL("https://parley.app/s/abc123-secret"))
    expect(url?.href).toBe("https://parley.app/s/:token")
    expect(url?.pathname).toBe("/s/:token")
  })

  it("keeps what follows the token, drops the query", () => {
    const url = redactShareToken(
      new URL("https://parley.app/s/abc123/more?x=1#y")
    )
    expect(url?.href).toBe("https://parley.app/s/:token/more")
  })

  // The router matches paths case-insensitively and decodes them.
  it.each(["/S/abc123", "/%73/abc123", "/%53/abc123", "/s%2Fabc123"])(
    "redacts %s, which the router still sends to /s/$token",
    (path) => {
      const url = redactShareToken(new URL(path, "https://parley.app"))
      expect(url?.href).toBe("https://parley.app/s/:token")
    }
  )

  it("leaves other paths alone", () => {
    for (const path of [
      "/",
      "/s",
      "/s/",
      "/d/d1",
      "/settings",
      "/%E0%A4%A",
      "/api/rpc/share/view",
    ]) {
      expect(
        redactShareToken(new URL(path, "https://parley.app"))
      ).toBeUndefined()
    }
  })
})
