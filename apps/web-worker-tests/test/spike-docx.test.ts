import { env } from "cloudflare:workers"
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { api } from "../../web/src/server/api"

// T2 spike: can `docx` build a DOCX inside workerd?
describe("GET /api/spike/docx in workerd", () => {
  it("returns a DOCX that opens as a Word package with the NDA text", async () => {
    const ctx = createExecutionContext()

    const response = await api.fetch(
      new Request("https://parley.test/api/spike/docx"),
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    const documentXml = await zip.file("word/document.xml")?.async("string")
    expect(documentXml).toContain("Mutual Non-Disclosure Agreement")
    expect(documentXml).toContain(
      "Use and Protection of Confidential Information"
    )
  })
})
