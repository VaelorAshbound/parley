// T2 spike: prove PDF (Browser Run) and DOCX (`docx`) both work on Workers.
// Throwaway: the real builders come in T12, and these routes go before launch.
import { Document, Packer, Paragraph, TextRun } from "docx"
import { Hono } from "hono"

import ndaMarkdown from "../../../../templates/Mutual-NDA.md?raw"

type Clause = { title: string; body: string }

// Just enough parsing for a realistic sample; the real parser is T5.
function sampleClauses(): Clause[] {
  return ndaMarkdown
    .split(/\n\s*\n/)
    .map((block) => block.replace(/<[^>]+>/g, "").trim())
    .flatMap((block) => {
      const match = /^\d+\.\s+\*\*(.+?)\*\*\.?\s*(.*)$/s.exec(block)
      return match?.[1] && match[2] !== undefined
        ? [{ title: match[1], body: match[2].replaceAll("**", "") }]
        : []
    })
}

const TITLE = "Mutual Non-Disclosure Agreement"

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function sampleHtml(clauses: Clause[]) {
  const items = clauses
    .map(
      (c, i) =>
        `<p><strong>${i + 1}. ${escapeHtml(c.title)}.</strong> ${escapeHtml(c.body)}</p>`
    )
    .join("\n")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title>
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.5;color:#1b1a17}h1{font-size:18pt;font-weight:600}p{margin:0 0 10pt}</style>
</head><body><h1>${TITLE}</h1>${items}</body></html>`
}

function sampleDocx(clauses: Clause[]) {
  return new Document({
    title: TITLE,
    sections: [
      {
        properties: {
          // US Letter in DXA (1440 = 1 inch); docx defaults to A4.
          page: { size: { width: 12240, height: 15840 } },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: TITLE, bold: true, size: 36 })],
          }),
          ...clauses.map(
            (c, i) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. ${c.title}. `, bold: true }),
                  new TextRun(c.body),
                ],
              })
          ),
        ],
      },
    ],
  })
}

export const spike = new Hono<{ Bindings: Env }>()
  .get("/pdf", async (c) => {
    const started = Date.now()
    const pdf = await c.env.BROWSER.quickAction("pdf", {
      html: sampleHtml(sampleClauses()),
      // Drafts are private: don't keep them in Browser Run's cache (default 5 s).
      cacheTTL: 0,
      pdfOptions: {
        format: "letter",
        margin: { top: "1in", right: "1in", bottom: "1in", left: "1in" },
        printBackground: true,
        tagged: true,
      },
    })
    if (!pdf.ok) return c.json({ error: "PDF failed", status: pdf.status }, 502)
    // Stream it through; no need to buffer the PDF in the Worker.
    return new Response(pdf.body, {
      headers: {
        "content-type": "application/pdf",
        "x-browser-ms-used": pdf.headers.get("x-browser-ms-used") ?? "",
        "server-timing": `pdf;dur=${Date.now() - started}`,
      },
    })
  })
  .get("/docx", async (c) => {
    const started = Date.now()
    const docx = await Packer.toArrayBuffer(sampleDocx(sampleClauses()))
    return c.body(docx, 200, {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "server-timing": `docx;dur=${Date.now() - started}`,
    })
  })
