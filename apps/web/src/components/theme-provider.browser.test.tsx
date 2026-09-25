import { afterEach, describe, expect, test } from "vite-plus/test"

import { withoutTransitions } from "./theme-provider"

// Switching the theme must not animate colors (found in T4): elements with
// `transition-all` would fade from the old theme's colors to the new ones.

const light = "rgb(255, 255, 255)"
const dark = "rgb(0, 0, 0)"

function probe() {
  const root = document.documentElement
  root.style.setProperty("--probe", light)
  const element = document.createElement("div")
  element.style.transition = "background-color 2s linear"
  element.style.backgroundColor = "var(--probe)"
  document.body.appendChild(element)
  // The start color is on screen before the switch.
  expect(getComputedStyle(element).backgroundColor).toBe(light)
  return {
    color: () => getComputedStyle(element).backgroundColor,
    switchTheme: () => root.style.setProperty("--probe", dark),
  }
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.style.removeProperty("--probe")
})

describe("withoutTransitions", () => {
  test("a plain switch animates (the problem)", () => {
    const { color, switchTheme } = probe()

    switchTheme()

    expect(color()).not.toBe(dark)
  })

  test("shows the new theme's colors at once", async () => {
    const { color, switchTheme } = probe()

    withoutTransitions(switchTheme)

    expect(color()).toBe(dark)
    // Transitions come back for everything else, and nothing starts late.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(
      false
    )
    expect(color()).toBe(dark)
  })
})
