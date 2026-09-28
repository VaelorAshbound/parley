import instrument400Ext from "@fontsource/instrument-sans/files/instrument-sans-latin-ext-400-normal.woff2?inline"
import instrument400 from "@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff2?inline"
import instrument600Ext from "@fontsource/instrument-sans/files/instrument-sans-latin-ext-600-normal.woff2?inline"
import instrument600 from "@fontsource/instrument-sans/files/instrument-sans-latin-600-normal.woff2?inline"
import instrument700Ext from "@fontsource/instrument-sans/files/instrument-sans-latin-ext-700-normal.woff2?inline"
import instrument700 from "@fontsource/instrument-sans/files/instrument-sans-latin-700-normal.woff2?inline"
import newsreader400Ext from "@fontsource/newsreader/files/newsreader-latin-ext-400-normal.woff2?inline"
import newsreader400 from "@fontsource/newsreader/files/newsreader-latin-400-normal.woff2?inline"
import newsreader500Ext from "@fontsource/newsreader/files/newsreader-latin-ext-500-normal.woff2?inline"
import newsreader500 from "@fontsource/newsreader/files/newsreader-latin-500-normal.woff2?inline"
import newsreader600Ext from "@fontsource/newsreader/files/newsreader-latin-ext-600-normal.woff2?inline"
import newsreader600 from "@fontsource/newsreader/files/newsreader-latin-600-normal.woff2?inline"
import newsreader700Ext from "@fontsource/newsreader/files/newsreader-latin-ext-700-normal.woff2?inline"
import newsreader700 from "@fontsource/newsreader/files/newsreader-latin-700-normal.woff2?inline"

// The brand fonts for the PDF's print page (T24). About 300 KB of base64, so
// files.ts loads this module only when a PDF is printed.
//
// Static fonts, one file per weight, not the app's variable fonts: Chrome
// embeds a variable font in a PDF as a Type 3 font (glyph drawings with no
// font name), and static ones as real TrueType subsets with a ToUnicode map
// (T31, checked on real Browser Run PDFs).

// Fontsource's unicode ranges for its "latin" and "latin-ext" files, so the
// browser only reads the file a text needs. Party names can have letters
// like "ő" or "Ł", which a fallback font would draw in another face.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

/** A weight's Latin and Latin Extended files as `@font-face` rules. */
function faces(family: string, weight: number, latin: string, ext: string) {
  const face = (url: string, range: string) =>
    `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};src:url(${url}) format("woff2");unicode-range:${range}}`
  return face(latin, LATIN) + face(ext, LATIN_EXT)
}

/**
 * Newsreader and Instrument Sans as `@font-face` rules with data URLs
 * (Vite's `?inline`): Browser Run has neither font, and it can't fetch from
 * a local dev server (T2, T12). Cloudflare documents base64 fonts for Quick
 * Actions: https://developers.cloudflare.com/browser-run/features/custom-fonts/#quick-actions
 *
 * Only the weights the print CSS uses: body 400, the title 500, headings and
 * clause numbers 600, and bold (`strong`) 700.
 */
export const FONT_CSS = [
  faces("Newsreader", 400, newsreader400, newsreader400Ext),
  faces("Newsreader", 500, newsreader500, newsreader500Ext),
  faces("Newsreader", 600, newsreader600, newsreader600Ext),
  faces("Newsreader", 700, newsreader700, newsreader700Ext),
  faces("Instrument Sans", 400, instrument400, instrument400Ext),
  faces("Instrument Sans", 600, instrument600, instrument600Ext),
  faces("Instrument Sans", 700, instrument700, instrument700Ext),
  // No "fi"/"ff" ligatures: Chrome writes a ligature's letters only as
  // /ActualText, which PDFium (Chrome, Edge) reads but pdf.js (Firefox's
  // viewer, most tools) doesn't, so "Confidential" couldn't be found or
  // copied there ("Con dential"). !important because the print CSS's `font`
  // shorthands reset this property.
  "*{font-variant-ligatures:no-common-ligatures!important}",
].join("")
