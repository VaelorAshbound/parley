import { describe, expect, it } from "vite-plus/test"

import { isNoneLine, type RenderedLine } from "../src/render/model.ts"

const empty = {
  type: "value" as const,
  field: "securityPolicy",
  label: "Security policy",
  text: null,
  placeholder: "[Security policy]",
  optional: true as const,
}

describe("isNoneLine", () => {
  it("is a line of nothing but empty optional values", () => {
    const line: RenderedLine = {
      parts: [{ type: "text", text: "available at " }, empty],
    }

    expect(isNoneLine(line)).toBe(true)
  })

  it("is not a line that mixes an empty optional value with a filled one", () => {
    // PAR-40: such a line keeps its template's words, with "None." inline.
    const line: RenderedLine = {
      parts: [
        empty,
        { type: "text", text: " and " },
        { ...empty, field: "other", text: "Filled" },
      ],
    }

    expect(isNoneLine(line)).toBe(false)
  })

  it("is not a line with no values, or with an empty required one", () => {
    const { optional: _required, ...required } = empty

    expect(isNoneLine({ parts: [{ type: "text", text: "Words" }] })).toBe(false)
    expect(isNoneLine({ parts: [required] })).toBe(false)
  })
})
