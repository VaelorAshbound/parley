import instrumentLatinExt from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-ext-wght-normal.woff2?inline"
import instrumentLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?inline"
import newsreaderLatinExt from "@fontsource-variable/newsreader/files/newsreader-latin-ext-opsz-normal.woff2?inline"
import newsreaderLatin from "@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?inline"

// The brand fonts for the PDF's print page (T24). About 290 KB of base64, so
// files.ts loads this module only when a PDF is printed.

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
 * Newsreader and Instrument Sans as `@font-face` rules with data URLs
 * (Vite's `?inline`): Browser Run has neither font, and it can't fetch from
 * a local dev server (T2, T12). Cloudflare documents base64 fonts for Quick
 * Actions: https://developers.cloudflare.com/browser-run/features/custom-fonts/#quick-actions
 */
export const FONT_CSS = [
  face("Newsreader Variable", "200 800", newsreaderLatin, LATIN),
  face("Newsreader Variable", "200 800", newsreaderLatinExt, LATIN_EXT),
  face("Instrument Sans Variable", "400 700", instrumentLatin, LATIN),
  face("Instrument Sans Variable", "400 700", instrumentLatinExt, LATIN_EXT),
].join("")
