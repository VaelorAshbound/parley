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

  it("leaves other paths alone", () => {
    for (const path of ["/", "/s", "/s/", "/d/d1", "/api/rpc/share/view"]) {
      expect(
        redactShareToken(new URL(path, "https://parley.app"))
      ).toBeUndefined()
    }
  })
})
