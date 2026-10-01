import { readFileSync } from "node:fs"

import { createFontStack } from "@capsizecss/core"
import arial from "@capsizecss/metrics/arial"
import arimo from "@capsizecss/metrics/arimo"
import instrumentSans from "@capsizecss/metrics/instrumentSans"
import newsreader from "@capsizecss/metrics/newsreader"
import notoSans from "@capsizecss/metrics/notoSans"
import notoSerif from "@capsizecss/metrics/notoSerif"
import timesNewRoman from "@capsizecss/metrics/timesNewRoman"
import tinos from "@capsizecss/metrics/tinos"
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
  // layout (brand.md → Type). One per platform's usual font: Windows and
  // macOS have Times New Roman and Arial; Linux has Liberation (the metrics
  // of Tinos and Arimo) or Noto. A face whose font isn't installed is
  // skipped, so the first one the system has is used. The CSS must match
  // Capsize's current metrics.
  const alsoLocal: Record<string, string[]> = {
    Tinos: ["Liberation Serif", "LiberationSerif"],
    Arimo: ["Liberation Sans", "LiberationSans"],
  }
  // oxfmt rewrites quotes and wraps long values, so compare without them.
  const unquote = (value?: string) =>
    value?.replaceAll(/["']/g, "").replaceAll(/\s+/g, " ").trim()

  function declaredFace(family: string) {
    const declared = new Map<string, string>()
    root.walkAtRules("font-face", (rule) => {
      const decls = new Map<string, string>()
      rule.walkDecls((decl) => {
        decls.set(decl.prop, decl.value)
      })
      if (unquote(decls.get("font-family")) === family) {
        for (const [prop, value] of decls) declared.set(prop, value)
      }
    })
    return declared
  }

  function stack(variable: string) {
    let value = ""
    root.walkDecls(variable, (decl) => {
      value = decl.value
    })
    return unquote(value)!
      .split(",")
      .map((name) => name.trim())
  }

  it.each([
    [
      "--font-serif",
      "Newsreader Variable",
      newsreader,
      [timesNewRoman, tinos, notoSerif],
    ],
    [
      "--font-sans",
      "Instrument Sans Variable",
      instrumentSans,
      [arial, arimo, notoSans],
    ],
  ] as const)(
    "%s: %s has metric-matched fallbacks",
    (variable, webFont, font, fallbacks) => {
      const { fontFaces } = createFontStack([font, ...fallbacks], {
        fontFaceFormat: "styleObject",
      })
      const families = fontFaces.map((face) =>
        unquote(face["@font-face"].fontFamily)!
      )

      // The web font, then each fallback face in order.
      expect(stack(variable).slice(0, families.length + 1)).toEqual([
        webFont,
        ...families,
      ])
      fallbacks.forEach((fallback, index) => {
        const face = fontFaces[index]!["@font-face"]
        const declared = declaredFace(unquote(face.fontFamily)!)
        const extra = (alsoLocal[fallback.familyName] ?? []).map(
          (name) => `local(${name})`
        )

        expect(unquote(declared.get("src"))).toBe(
          [unquote(face.src), ...extra].join(", ")
        )
        expect(declared.get("ascent-override")).toBe(face.ascentOverride)
        expect(declared.get("descent-override")).toBe(face.descentOverride)
        expect(declared.get("line-gap-override")).toBe(face.lineGapOverride)
        expect(declared.get("size-adjust")).toBe(face.sizeAdjust)
      })
    }
  )
})
