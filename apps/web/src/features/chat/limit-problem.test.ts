import { ORPCError } from "@orpc/client"
import { describe, expect, it } from "vite-plus/test"

import { limitProblem } from "./limit-problem"

const draftPath = "/d/0199c0de-0000-7000-8000-000000000002"
const resetsAt = "2026-09-26T00:00:00.000Z"

function dailyLimit(tier: "guest" | "free" | "pro", limit: number) {
  return new ORPCError("DAILY_LIMIT", {
    defined: true,
    status: 429,
    data: { limit, tier, resetsAt },
  })
}

// Times in UTC here; the browser shows the user's own.
const inUtc = { timeZone: "UTC", locale: "en-US" }

describe("limitProblem", () => {
  it("offers a guest an account, and brings them back to the draft", () => {
    expect(limitProblem(dailyLimit("guest", 20), draftPath, inUtc)).toEqual({
      message:
        "You’ve used today’s 20 messages. Create a free account for 100 a day. Your draft comes with you.",
      action: {
        label: "Create an account",
        href: `/sign-up?redirect=${encodeURIComponent(draftPath)}`,
      },
      retry: false,
    })
  })

  it("tells a free user when messages come back, and offers Pro", () => {
    expect(limitProblem(dailyLimit("free", 100), draftPath, inUtc)).toEqual({
      message:
        "You’ve used today’s 100 messages. More come at 12:00 AM, or get 500 a day with Pro.",
      action: { label: "Get Pro", href: "/pricing" },
      retry: false,
    })
  })

  it("tells a Pro user when messages come back", () => {
    expect(limitProblem(dailyLimit("pro", 500), draftPath, inUtc)).toEqual({
      message: "You’ve used today’s 500 messages. More come at 12:00 AM.",
      retry: false,
    })
  })

  it("asks to slow down and try again after a burst", () => {
    const error = new ORPCError("TOO_MANY_REQUESTS", {
      defined: true,
      status: 429,
    })

    expect(limitProblem(error, draftPath, inUtc)).toEqual({
      message:
        "You’re sending messages quickly. Wait a few seconds, then try again.",
      retry: true,
    })
  })

  it.each([
    ["another typed error", new ORPCError("NOT_FOUND", { defined: true })],
    ["an untyped 429", new ORPCError("DAILY_LIMIT", { status: 429 })],
    ["a network error", new TypeError("Failed to fetch")],
  ])("is null for %s", (_, error) => {
    expect(limitProblem(error, draftPath, inUtc)).toBeNull()
  })
})
