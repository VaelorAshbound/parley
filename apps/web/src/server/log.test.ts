import { describe, expect, it, vi } from "vite-plus/test"

import { logError, logInfo, logWarn } from "./log"

// Workers Logs indexes the keys of a logged object, so each line is one
// object with a stable event name (spec §5 Hono, T29).

describe("the structured logger", () => {
  it("writes one object per event, at the level's console method", () => {
    using info = vi.spyOn(console, "log").mockImplementation(() => {})
    using warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logInfo("draft_saved", { changes: 2 })
    logWarn("answers_refused", { toolCallId: "call-1" })

    expect(info.mock.calls).toEqual([
      [{ level: "info", event: "draft_saved", changes: 2 }],
    ])
    expect(warn.mock.calls).toEqual([
      [{ level: "warn", event: "answers_refused", toolCallId: "call-1" }],
    ])
  })

  it("leaves out fields that have no value", () => {
    using info = vi.spyOn(console, "log").mockImplementation(() => {})

    logInfo("chat_turn", { tier: undefined, steps: 1 })

    expect(info.mock.calls[0]?.[0]).toEqual({
      level: "info",
      event: "chat_turn",
      steps: 1,
    })
  })

  it("keeps an error's name and message only: no stack, cause or detail", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    // Postgres errors carry the row's values in `detail`.
    const failed = Object.assign(new Error("duplicate key"), {
      detail: "Key (email)=(ada@example.com) already exists.",
      cause: new Error("ada@example.com"),
    })

    logError("rpc_error", failed, { route: "/api/rpc/drafts/get" })

    expect(error.mock.calls).toEqual([
      [
        {
          level: "error",
          event: "rpc_error",
          route: "/api/rpc/drafts/get",
          error: { name: "Error", message: "duplicate key" },
        },
      ],
    ])
  })

  it("logs what was thrown when it isn't an Error", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})

    logError("api_error", "down")

    expect(error.mock.calls[0]?.[0]).toMatchObject({
      error: { message: "down" },
    })
  })
})
