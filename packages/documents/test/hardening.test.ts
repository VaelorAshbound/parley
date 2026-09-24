import fc from "fast-check"
import JSZip from "jszip"
import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { definitions } from "../src/definitions/index.ts"
import { field } from "../src/fields.ts"
import { toDocx } from "../src/output/docx.ts"
import { render } from "../src/render.ts"

// Findings from the pre-checkpoint engine review.

describe("text people and the AI type", () => {
  const purpose = field.longText({ label: "Purpose", help: "Why." })

  it.each([
    ["a NUL", "Bad\u0000char"],
    ["a vertical tab", "Bad\u000Bchar"],
    ["an escape", "Bad\u001Bchar"],
    ["a right-to-left override", "Pay ‮eno‬ dollars"],
    ["a bidi isolate", "Pay ⁦x⁩"],
    ["a lone surrogate", "Bad\uD800char"],
    ["a non-character", "Bad￾char"],
  ])("refuses %s, which a contract must never hide", (_name, value) => {
    expect(purpose.schema.safeParse(value).success).toBe(false)
  })

  it("keeps line breaks and tabs, and turns Windows line breaks into plain ones", () => {
    expect(purpose.schema.parse("One\r\nTwo\tthree")).toBe("One\nTwo\tthree")
  })

  it("always gives a DOCX whose XML Word can open", async () => {
    const nda = definitions["mutual-nda"]
    await fc.assert(
      fc.asyncProperty(
        fc.string({ unit: "binary", maxLength: 40 }),
        async (text) => {
          const { values } = applyFieldChanges(nda, {}, [
            { key: "purpose", value: text },
          ])
          const zip = await JSZip.loadAsync(await toDocx(render(nda, values)))
          const xml =
            (await zip.file("word/document.xml")?.async("string")) ?? ""

          expect(forbiddenInXml(xml)).toEqual([])
        }
      ),
      { numRuns: 60 }
    )
  })
})

describe("a half-filled group", () => {
  it("formats the parts it has, whatever their kind", () => {
    const terms = field.group({
      label: "Terms",
      help: "Extra terms.",
      parts: {
        note: field.text({ label: "Note", help: "A note.", optional: true }),
        term: field.duration({
          label: "Term",
          help: "How long.",
          optional: true,
        }),
      },
    })

    expect(terms.format({ note: "Renews yearly." })).toBe(
      "Note: Renews yearly."
    )
  })
})

/** XML 1.0 allows only tab, newline and carriage return below U+0020. */
function forbiddenInXml(xml: string) {
  const found: number[] = []
  for (let index = 0; index < xml.length; index++) {
    const code = xml.charCodeAt(index)
    const allowed = code === 0x09 || code === 0x0a || code === 0x0d
    if ((code < 0x20 && !allowed) || code === 0xfffe || code === 0xffff)
      found.push(code)
  }
  return found
}

describe("a missing required field", () => {
  it("says to fill it in, not 'Invalid input'", () => {
    const { issues = [] } =
      definitions["mutual-nda"].schema.safeParse({}).error ?? {}

    expect(issues.length).toBeGreaterThan(0)
    expect(new Set(issues.map((issue) => issue.message))).toEqual(
      new Set(["Fill this in."])
    )
  })
})
