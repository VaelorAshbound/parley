import {
  render,
  type DocumentDefinition,
  type DraftValues,
  type Fields,
} from "@workspace/documents"
import { toPrintHtml } from "@workspace/documents/print"

import type { ExportFormat } from "./quota"

// The files a user downloads (T24): the PDF, printed by Browser Run from the
// engine's print page, and the Word file, built here in the Worker. Both
// come from the same render model as the preview (spec §2 Document engine).

const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const satisfies Record<ExportFormat, string>

/**
 * Characters no file name may hold on Windows, macOS or Linux: control
 * characters (\p{Cc}) and the ones Windows reserves.
 */
const UNSAFE = /[\p{Cc}/\\:*?"<>|]+/gu

function clean(text: string, max: number) {
  return text
    .replace(UNSAFE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim()
}

/**
 * `<Title> – <Document>.pdf`, or just the agreement's name while the draft
 * is still called by it.
 */
export function fileName(
  title: string,
  documentName: string,
  format: ExportFormat
) {
  const name = clean(documentName, 100)
  const own = clean(title, 80)
  return `${own && own !== name ? `${own} – ${name}` : name}.${format}`
}

export type PrintedPdf = { bytes: ArrayBuffer; browserMs: number | undefined }
/** Prints an HTML page to a PDF. The Worker uses Browser Run; tests fake it. */
export type PrintPdf = (html: string) => Promise<PrintedPdf>

/** Browser Run couldn't print: its HTTP status (429 is its rate limit). */
export class PrintFailed extends Error {
  override name = "PrintFailed"
  constructor(readonly status: number) {
    super(`Browser Run answered ${status}`)
  }
}

/**
 * Prints with Browser Run's PDF Quick Action.
 * https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/
 */
export function browserRunPrinter(browser: BrowserRun): PrintPdf {
  return async (html) => {
    const response = await browser.quickAction("pdf", {
      html,
      // Drafts are private: never keep them in Browser Run's cache.
      cacheTTL: 0,
      // The page size and margins come from the print CSS's @page rule.
      pdfOptions: {
        preferCSSPageSize: true,
        printBackground: true,
        tagged: true,
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new PrintFailed(response.status)
    }
    const used = Number(response.headers.get("x-browser-ms-used"))
    return {
      bytes: await response.arrayBuffer(),
      browserMs: Number.isFinite(used) && used > 0 ? used : undefined,
    }
  }
}

/**
 * The draft as a file, and the Browser Run time it took (PDF only). The
 * fonts (about 290 KB) and the `docx` library (about 170 KB) load on first
 * use, so requests that never export don't pay to start them.
 */
export async function buildFile<F extends Fields>(
  format: ExportFormat,
  {
    title,
    definition,
    values,
  }: {
    title: string
    definition: DocumentDefinition<F>
    values: DraftValues<F>
  },
  printPdf: PrintPdf
) {
  const document = render(definition, values)
  const { bytes, browserMs } =
    format === "pdf"
      ? await printPdf(
          toPrintHtml(document, {
            fontCss: (await import("./fonts")).FONT_CSS,
          })
        )
      : {
          bytes: await (
            await import("@workspace/documents/docx")
          ).toDocx(document),
          browserMs: undefined,
        }
  return {
    file: new File([bytes], fileName(title, definition.name, format), {
      type: TYPES[format],
    }),
    browserMs,
  }
}
