import { describe, expect, it } from "vite-plus/test"

import { coverage, defineDocument } from "../src/define.ts"
import { field } from "../src/fields.ts"
import { toDocx } from "../src/output/docx.ts"
import { toPrintHtml } from "../src/output/html.ts"
import { render } from "../src/render.ts"
import { template } from "./fixtures.ts"

// Cover page layout features from Common Paper's official pages (T7b).

function dpa() {
  return defineDocument({
    id: "layout",
    version: 1,
    name: "Layout",
    template,
    fields: {
      specialData: field.choice({
        label: "Special category data",
        help: "Whether any is processed.",
        options: { yes: { label: "Yes" }, no: { label: "No" } },
      }),
      safeguards: field.longText({
        label: "Safeguards",
        help: "Extra care for special data.",
        optional: true,
      }),
      rejection: field.duration({
        label: "Rejection period",
        help: "Time to reject.",
      }),
      provider: field.party({ label: "Provider", help: "The provider." }),
    },
    linkedTerms: {
      Purpose: "specialData",
      "Governing Law": "safeguards",
      "Notice Address": ["provider.notice"],
    },
    coverPage: {
      source: "parley",
      title: "Layout",
      intro: [],
      sections: [
        { heading: "Key Terms", part: true },
        { heading: "Special Category Data", field: "specialData" },
        {
          heading: "Safeguards",
          field: "safeguards",
          when: { field: "specialData", option: "yes" },
        },
        {
          heading: "Rejection Period",
          field: "rejection",
          template: "{value} from notice of rejection",
        },
        {
          heading: "Notices",
          lines: [
            {
              label: "Email",
              field: "provider.email",
              template: "Send to {value}",
            },
          ],
        },
      ],
      closing: [],
      signatures: ["provider"],
      signatureRows: [
        { label: "Signature", part: null },
        { label: "Name", part: "name" },
        { label: "Title", part: "title" },
        { label: "Date", part: null },
      ],
      footer: [],
    },
  })
}

describe("cover page layout", () => {
  it("prints part headings between sections", () => {
    const [first] = render(dpa(), {}).coverPage.sections

    expect(first).toMatchObject({ heading: "Key Terms", part: true, lines: [] })
  })

  it("wraps a value in its template's words", () => {
    const sections = render(dpa(), {
      rejection: { amount: 10, unit: "businessDays" },
    }).coverPage.sections
    const rejection = sections.find(
      (section) => section.heading === "Rejection Period"
    )

    expect(rejection?.lines[0]?.parts).toEqual([
      expect.objectContaining({ type: "value", text: "10 business days" }),
      { type: "text", text: " from notice of rejection" },
    ])
  })

  it("wraps a line's value too, with words before it", () => {
    const notices = render(dpa(), {
      provider: { email: "legal@acme.test" },
    }).coverPage.sections.find((section) => section.heading === "Notices")

    expect(notices?.lines[0]).toEqual({
      label: "Email",
      parts: [
        { type: "text", text: "Send to " },
        expect.objectContaining({ type: "value", text: "legal@acme.test" }),
      ],
    })
  })

  it("shows a row only when its condition holds", () => {
    const headings = (
      values: Parameters<typeof render<ReturnType<typeof dpa>["fields"]>>[1]
    ) =>
      render(dpa(), values).coverPage.sections.map((section) => section.heading)

    expect(headings({ specialData: { option: "no" } })).not.toContain(
      "Safeguards"
    )
    expect(headings({ specialData: { option: "yes" } })).toContain("Safeguards")
    expect(headings({})).not.toContain("Safeguards")
  })

  it("signs with the rows the document asks for", () => {
    const { rows } = render(dpa(), {}).coverPage.signatures

    expect(rows.map((row) => row.label)).toEqual([
      "Signature",
      "Name",
      "Title",
      "Date",
    ])
  })

  it("counts fields in hidden rows and part headings as laid out", () => {
    expect(coverage(dpa()).unusedFields).toEqual([])
  })

  it("prints part headings in the PDF and the DOCX", async () => {
    const rendered = render(dpa(), {})

    expect(toPrintHtml(rendered)).toContain('<h2 class="part">Key Terms</h2>')
    const docx = new TextDecoder().decode(await toDocx(rendered))
    expect(docx.length).toBeGreaterThan(0)
  })
})

describe("layout checks when a document is defined", () => {
  const base = dpa()

  it.each([
    [
      "a template with no {value}",
      { heading: "R", field: "rejection", template: "from notice" },
      'Section "R": its template needs {value} exactly once.',
    ],
    [
      "a template on a field that prints several lines",
      { heading: "S", field: "specialData", template: "{value}!" },
      'Section "S": a template only fits a field printed on one line.',
    ],
    [
      "a condition on a field that is not a choice",
      {
        heading: "S",
        field: "safeguards",
        when: { field: "rejection", option: "yes" },
      },
      'Section "S": its condition must name a choice and one of its options.',
    ],
    [
      "a condition on an option that doesn't exist",
      {
        heading: "S",
        field: "safeguards",
        when: { field: "specialData", option: "maybe" },
      },
      'Section "S": its condition must name a choice and one of its options.',
    ],
  ])("refuses %s", (_name, section, message) => {
    expect(() =>
      defineDocument({
        ...base,
        coverPage: {
          ...base.coverPage,
          // @ts-expect-error: some of these are type errors too; this checks the runtime guard.
          sections: [section],
        },
      })
    ).toThrow(message)
  })
})
