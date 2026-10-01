import { describe, expect, it } from "vite-plus/test"

import { errorsOf } from "./control"

describe("errorsOf", () => {
  it("takes the editor's text errors", () => {
    expect(errorsOf(["Too long", ""])).toEqual([{ message: "Too long" }])
  })

  it("takes a Zod schema's issues (sign-in and sign-up forms)", () => {
    expect(
      errorsOf([{ message: "Please enter your name.", path: ["name"] }])
    ).toEqual([{ message: "Please enter your name." }])
  })

  it("skips anything without a message", () => {
    expect(errorsOf([undefined, null, 42, {}])).toEqual([])
  })
})
