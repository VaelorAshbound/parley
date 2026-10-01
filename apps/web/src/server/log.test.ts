import { DrizzleQueryError } from "drizzle-orm"
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

  it("keeps an error's name and code, never its message, stack or detail", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    // Postgres errors carry the row's values in `detail`, and some messages
    // quote the value that failed.
    const failed = Object.assign(
      new Error('invalid input syntax for type uuid: "ada@example.com"'),
      {
        code: "22P02",
        detail: "Key (email)=(ada@example.com) already exists.",
      }
    )

    logError("rpc_error", failed, { route: "/api/rpc/drafts/get" })

    expect(error.mock.calls).toEqual([
      [
        {
          level: "error",
          event: "rpc_error",
          route: "/api/rpc/drafts/get",
          error: { name: "Error", code: "22P02" },
        },
      ],
    ])
  })

  it("leaves out a failed query's SQL and values, and names its cause", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    // Drizzle puts the query and its bound values in the message.
    const cause = Object.assign(new Error("connection refused"), {
      name: "DatabaseError",
      code: "08006",
    })
    const failed = new DrizzleQueryError(
      'update "draft" set "fields" = $1',
      ["Acme Secret", "session-token-123"],
      cause
    )

    logError("rpc_error", failed)

    expect(error.mock.calls[0]?.[0]).toMatchObject({
      error: {
        name: "DrizzleQueryError",
        code: "08006",
        cause: "DatabaseError",
      },
    })
    const text = JSON.stringify(error.mock.calls)
    expect(text).not.toContain("Acme Secret")
    expect(text).not.toContain("session-token-123")
    expect(text).not.toContain("draft")
  })

  it("logs only a code that looks like one", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})

    logError(
      "api_error",
      Object.assign(new Error("x"), { code: "ada lovelace" })
    )

    expect(error.mock.calls[0]?.[0]).toMatchObject({ error: { name: "Error" } })
    expect(JSON.stringify(error.mock.calls)).not.toContain("ada")
  })

  it("logs only the type of what was thrown when it isn't an Error", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})

    logError("api_error", "Acme Secret")

    expect(error.mock.calls[0]?.[0]).toMatchObject({
      error: { name: "string" },
    })
    expect(JSON.stringify(error.mock.calls)).not.toContain("Acme")
  })
})
