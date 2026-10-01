import { describe, expect, it } from "vite-plus/test"

import { redirectSearch } from "./redirect"

const parse = (redirect: unknown) => redirectSearch.parse({ redirect }).redirect

describe("the redirect after signing in", () => {
  it("keeps a path on Parley", () => {
    expect(parse("/d/0b6f1c1e-5b0e-4a51-9d51-6f3c4f7a9a10?panel=open")).toBe(
      "/d/0b6f1c1e-5b0e-4a51-9d51-6f3c4f7a9a10?panel=open"
    )
  })

  it.each([
    ["another site", "https://evil.example/d/1"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash browsers read as a slash", "/\\evil.example"],
    ["a script URL", "javascript:alert(1)"],
    ["a relative path", "d/1"],
    ["something that isn't text", 42],
  ])("ignores %s", (_, redirect) => {
    expect(parse(redirect)).toBeUndefined()
  })

  it("is optional", () => {
    expect(redirectSearch.parse({})).toEqual({})
  })
})
