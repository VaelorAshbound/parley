import { describe, expect, it } from "vite-plus/test"

import { tierOf } from "./base"

describe("tierOf", () => {
  it("names a guest's plan", () => {
    expect(tierOf({ isAnonymous: true })).toBe("guest")
  })

  it("names a signed-up user's plan", () => {
    expect(tierOf({ isAnonymous: false })).toBe("free")
    expect(tierOf({ isAnonymous: null })).toBe("free")
  })
})
