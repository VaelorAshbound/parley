// The two Latin faces every page uses first, for <link rel="preload">
// (brand.md → Type). Vite gives them the same hashed URL as the @font-face
// rules in globals.css, so the preload is reused, not fetched twice.
import newsreader from "@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url"
import newsreaderItalic from "@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2?url"
import instrumentSans from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url"

const preload = (href: string) =>
  ({
    rel: "preload",
    href,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  }) as const

export const fontPreloads = [newsreader, instrumentSans].map(preload)

/**
 * The serif italic, for a page that sets it above the fold (the start page's
 * headline). Its fallback is wider, so without it the headline loads a line
 * taller and then jumps (T37 review).
 */
export const italicPreload = preload(newsreaderItalic)
