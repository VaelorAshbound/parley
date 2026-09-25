import instrumentLatinExt from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-ext-wght-normal.woff2?inline"
import instrumentLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?inline"
import newsreaderLatinExt from "@fontsource-variable/newsreader/files/newsreader-latin-ext-opsz-normal.woff2?inline"
import newsreaderLatin from "@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?inline"
import {
  render,
  type DocumentDefinition,
  type DraftValues,
  type Fields,
} from "@workspace/documents"
import { toDocx } from "@workspace/documents/docx"
import { toPrintHtml } from "@workspace/documents/print"

import type { ExportFormat } from "./quota"

// The files a user downloads (T24): the PDF, printed by Browser Run from the
// engine's print page, and the Word file, built here in the Worker. Both
// come from the same render model as the preview (spec §2 Document engine).

// Fontsource's unicode ranges for its "latin" and "latin-ext" files, so the
// browser only reads the file a text needs. Party names can have letters
// like "ő" or "Ł", which a fallback font would draw in another face.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

function face(family: string, weight: string, url: string, range: string) {
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};src:url(${url}) format("woff2");unicode-range:${range}}`
}

/**
 * The brand fonts for the print page, embedded as data URLs (Vite's
 * `?inline`): Browser Run has neither font, and it can't fetch from a local
 * dev server (T2, T12). Cloudflare documents base64 fonts for Quick Actions:
 * https://developers.cloudflare.com/browser-run/features/custom-fonts/#quick-actions
 */
export const FONT_CSS = [
  face("Newsreader Variable", "200 800", newsreaderLatin, LATIN),
  face("Newsreader Variable", "200 800", newsreaderLatinExt, LATIN_EXT),
  face("Instrument Sans Variable", "400 700", instrumentLatin, LATIN),
  face("Instrument Sans Variable", "400 700", instrumentLatinExt, LATIN_EXT),
].join("")

const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const satisfies Record<ExportFormat, string>

/** Characters no file name may hold on Windows, macOS or Linux. */
const UNSAFE = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g

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

/** The draft as a file, and the Browser Run time it took (PDF only). */
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
      ? await printPdf(toPrintHtml(document, { fontCss: FONT_CSS }))
      : { bytes: await toDocx(document), browserMs: undefined }
  return {
    file: new File([bytes], fileName(title, definition.name, format), {
      type: TYPES[format],
    }),
    browserMs,
  }
}
