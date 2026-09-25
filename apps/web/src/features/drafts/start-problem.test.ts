import { ORPCError } from "@orpc/client"
import { describe, expect, it } from "vite-plus/test"

import { humanCheckFailed } from "@/features/auth/messages"
import { GuestSignInError } from "@/lib/auth-client"

import { startProblem } from "./start-problem"

describe("startProblem", () => {
  it("asks a guest with a draft to make an account for another", () => {
    const error = new ORPCError("DRAFT_LIMIT", {
      defined: true,
      data: { limit: 1 },
    })

    expect(startProblem(error)).toEqual({
      message:
        "Guests keep one draft. Create a free account to start another. Your draft comes with you.",
      action: { label: "Create an account", href: "/sign-up" },
    })
  })

  it("says the person check failed", () => {
    expect(startProblem(new GuestSignInError("human-check"))).toEqual({
      message: humanCheckFailed,
    })
  })

  it("offers an account when the network made too many guests", () => {
    expect(startProblem(new GuestSignInError("busy"))).toEqual({
      message:
        "Many people started as guests from your network just now. Create a free account to start, or try again in an hour.",
      action: { label: "Create an account", href: "/sign-up" },
    })
  })

  it.each([
    ["a failed sign-in", new GuestSignInError("failed")],
    ["a server error", new ORPCError("INTERNAL_SERVER_ERROR")],
    ["a network error", new TypeError("Failed to fetch")],
  ])("asks to try again after %s", (_, error) => {
    expect(startProblem(error)).toEqual({
      message: "We couldn’t start that draft. Please try again.",
    })
  })
})
