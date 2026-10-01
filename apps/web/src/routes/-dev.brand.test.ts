import { isNotFound } from "@tanstack/react-router"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { Route } from "./dev.brand"

function runBeforeLoad() {
  // The guard reads nothing from its context.
  return Route.options.beforeLoad?.({} as never)
}

describe("/dev/brand", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is not found outside dev", () => {
    vi.stubEnv("DEV", false)

    let thrown: unknown
    try {
      runBeforeLoad()
    } catch (error) {
      thrown = error
    }

    expect(isNotFound(thrown)).toBe(true)
  })

  it("opens in dev", () => {
    vi.stubEnv("DEV", true)

    expect(() => runBeforeLoad()).not.toThrow()
  })
})
