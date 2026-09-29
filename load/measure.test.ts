import { describe, expect, it } from "vite-plus/test"

import { isFirstToken, loadTestTarget, percentile } from "./measure.ts"

describe("percentile", () => {
  it("gives the middle value as p50 of an odd list", () => {
    expect(percentile([300, 100, 200], 50)).toBe(200)
  })

  it("gives the nearest-rank value, never one between two samples", () => {
    expect(percentile([100, 200, 300, 400], 50)).toBe(200)
    expect(percentile([100, 200, 300, 400], 95)).toBe(400)
  })

  it("refuses an empty list", () => {
    expect(() => percentile([], 50)).toThrow("no samples")
  })
})

describe("isFirstToken", () => {
  it("counts the model's first text", () => {
    expect(isFirstToken({ type: "text-delta", id: "t0", delta: "Hi" })).toBe(
      true
    )
  })

  it("counts the model's first tool call, which fills the document", () => {
    expect(isFirstToken({ type: "tool-input-start", toolCallId: "c1" })).toBe(
      true
    )
    expect(
      isFirstToken({ type: "tool-input-available", toolCallId: "c1" })
    ).toBe(true)
  })

  it("does not count the frames sent before the model answers", () => {
    expect(isFirstToken({ type: "start" })).toBe(false)
    expect(isFirstToken({ type: "start-step" })).toBe(false)
    expect(isFirstToken({ type: "text-start", id: "t0" })).toBe(false)
  })
})

describe("loadTestTarget", () => {
  it("accepts a Worker Preview", () => {
    expect(
      loadTestTarget("https://par-1-parley-parley.vaelorashbound.workers.dev/")
    ).toBe("https://par-1-parley-parley.vaelorashbound.workers.dev")
  })

  it("accepts the local dev server", () => {
    expect(loadTestTarget("http://localhost:3103")).toBe(
      "http://localhost:3103"
    )
  })

  it("never load-tests production", () => {
    expect(() => loadTestTarget("https://parley.runtimedrift.dev")).toThrow(
      "production"
    )
  })

  it("refuses any other host, which could be production under a new name", () => {
    expect(() => loadTestTarget("https://example.com")).toThrow(
      "Worker Preview"
    )
  })

  it("asks for a URL when none is given", () => {
    expect(() => loadTestTarget(undefined)).toThrow("PREVIEW_URL")
  })
})
