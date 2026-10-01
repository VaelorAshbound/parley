import { describe, expect, it } from "vite-plus/test"

import { bold, link, paragraph } from "../src/definitions/prose.ts"

describe("prose helpers", () => {
  it("builds a paragraph from text, bold terms and links", () => {
    expect(
      paragraph(
        "Uses the (“",
        bold("Standard Terms"),
        "”) posted at ",
        link("commonpaper.com", "https://commonpaper.com/"),
        "."
      )
    ).toEqual([
      { type: "text", value: "Uses the (“" },
      { type: "strong", children: [{ type: "text", value: "Standard Terms" }] },
      { type: "text", value: "”) posted at " },
      {
        type: "link",
        href: "https://commonpaper.com/",
        children: [{ type: "text", value: "commonpaper.com" }],
      },
      { type: "text", value: "." },
    ])
  })
})
