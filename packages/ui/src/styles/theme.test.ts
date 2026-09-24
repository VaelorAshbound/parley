import { readFileSync } from "node:fs"

import { createFontStack } from "@capsizecss/core"
import arial from "@capsizecss/metrics/arial"
import instrumentSans from "@capsizecss/metrics/instrumentSans"
import newsreader from "@capsizecss/metrics/newsreader"
import timesNewRoman from "@capsizecss/metrics/timesNewRoman"
import { wcagContrast } from "culori"
import postcss from "postcss"
import { describe, expect, it } from "vite-plus/test"

// Read from disk: Vitest stubs CSS imports, `?raw` included.
const css = readFileSync(new URL("globals.css", import.meta.url), "utf8")
const root = postcss.parse(css)

function tokens(selector: string) {
  const found = new Map<string, string>()
  root.walkRules(selector, (rule) => {
    rule.walkDecls(/^--/, (decl) => {
      found.set(decl.prop, decl.value)
    })
  })
  return found
}

const light = tokens(":root")
const themes = { light, dark: new Map([...light, ...tokens(".dark")]) }

// Every text/background pair the UI uses. WCAG 2.x AA: 4.5 for text,
// 3 for non-text UI like the focus ring (brand.md → Color).
const TEXT = 4.5
const UI = 3
const pairs: [fg: string, bg: string, min: number][] = [
  ["foreground", "background", TEXT],
  ["foreground", "paper-deep", TEXT],
  ["foreground", "sheet", TEXT],
  ["foreground", "bubble", TEXT],
  ["card-foreground", "card", TEXT],
  ["popover-foreground", "popover", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["secondary-foreground", "secondary", TEXT],
  ["accent-foreground", "accent", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "paper-deep", TEXT],
  ["muted-foreground", "card", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["muted-foreground", "sheet", TEXT],
  ["muted-foreground", "sidebar", TEXT],
  ["muted-foreground", "empty", TEXT],
  ["ink-2", "background", TEXT],
  ["ink-2", "card", TEXT],
  ["ink-2", "sidebar", TEXT],
  ["sidebar-foreground", "sidebar", TEXT],
  ["sidebar-accent-foreground", "sidebar-accent", TEXT],
  ["sidebar-primary-foreground", "sidebar-primary", TEXT],
  ["blue-ink", "background", TEXT],
  ["blue-ink", "card", TEXT],
  ["blue-ink", "sheet", TEXT],
  ["blue-ink", "blue-tint", TEXT],
  ["blue-ink", "highlighter", TEXT],
  ["blue-ink", "highlighter-soft", TEXT],
  ["on-blue", "blue-ink", TEXT],
  ["destructive", "background", TEXT],
  ["destructive", "card", TEXT],
  ["ring", "background", UI],
  ["ring", "card", UI],
]

describe.each(Object.entries(themes))("%s theme", (_name, theme) => {
  it.each(pairs)("%s on %s passes %d:1", (fg, bg, min) => {
    const fgColor = theme.get(`--${fg}`)
    const bgColor = theme.get(`--${bg}`)

    expect(fgColor, `--${fg}`).toMatch(/^#[0-9a-f]{6}$/i)
    expect(bgColor, `--${bg}`).toMatch(/^#[0-9a-f]{6}$/i)
    expect(wcagContrast(fgColor!, bgColor!)).toBeGreaterThanOrEqual(min)
  })
})

describe("font fallbacks", () => {
  // Metric-matched fallbacks keep the swap to the web font from shifting the
  // layout (brand.md → Type). The CSS must match Capsize's current metrics.
  it.each([
    ["Newsreader Variable", newsreader, timesNewRoman],
    ["Instrument Sans Variable", instrumentSans, arial],
  ] as const)("%s has a metric-matched fallback", (_family, font, fallback) => {
    const { fontFaces } = createFontStack([font, fallback], {
      fontFaceFormat: "styleObject",
    })
    const face = fontFaces[0]!["@font-face"]
    const declared = new Map<string, string>()
    root.walkAtRules("font-face", (rule) => {
      const decls = new Map<string, string>()
      rule.walkDecls((decl) => {
        decls.set(decl.prop, decl.value)
      })
      if (decls.get("font-family")?.includes(face.fontFamily)) {
        for (const [prop, value] of decls) declared.set(prop, value)
      }
    })

    // oxfmt rewrites the quotes, so compare without them.
    const unquote = (value?: string) => value?.replaceAll(/["']/g, "")
    expect(unquote(declared.get("src"))).toBe(unquote(face.src))
    expect(declared.get("ascent-override")).toBe(face.ascentOverride)
    expect(declared.get("descent-override")).toBe(face.descentOverride)
    expect(declared.get("line-gap-override")).toBe(face.lineGapOverride)
    expect(declared.get("size-adjust")).toBe(face.sizeAdjust)
  })
})
