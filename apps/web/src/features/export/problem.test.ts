import { ORPCError } from "@orpc/client"
import { describe, expect, it } from "vite-plus/test"

import { exportProblem } from "./problem"

const draftPath = "/d/0199a1b2-0000-7000-8000-000000000000"

function defined(code: string, data?: unknown) {
  return new ORPCError(code, { defined: true, data })
}

describe("exportProblem", () => {
  it("asks a guest to make a free account, and brings them back", () => {
    expect(
      exportProblem(defined("UNAUTHORIZED"), { format: "pdf", draftPath })
    ).toEqual({
      message: "Create a free account to download. Your draft comes with you.",
      action: {
        label: "Create an account",
        href: `/sign-up?redirect=${encodeURIComponent(draftPath)}`,
      },
    })
  })

  it("asks for the email to be confirmed", () => {
    expect(
      exportProblem(defined("EMAIL_NOT_VERIFIED"), { format: "pdf", draftPath })
    ).toEqual({
      message: "Confirm your email to download. We sent you a link.",
    })
  })

  it("offers Pro when the month's free documents are used", () => {
    expect(
      exportProblem(defined("QUOTA_EXCEEDED", { limit: 3 }), {
        format: "pdf",
        draftPath,
      })
    ).toEqual({
      message:
        "You've used your 3 free documents this month. Documents you already downloaded stay free.",
      action: { label: "Get unlimited with Pro", href: "/pricing" },
    })
  })

  it("offers Pro for a Word file, and says a PDF still works", () => {
    expect(
      exportProblem(defined("PRO_REQUIRED"), { format: "docx", draftPath })
    ).toEqual({
      message: "Word files come with Pro. You can still download a PDF.",
      action: { label: "Upgrade to Pro", href: "/pricing" },
    })
  })

  it("names what is still missing", () => {
    expect(
      exportProblem(
        defined("INCOMPLETE", {
          missing: [
            { key: "governingLaw", label: "Governing law" },
            { key: "party2", label: "Party 2" },
          ],
        }),
        { format: "pdf", draftPath }
      )
    ).toEqual({ message: "Fill in Governing law and Party 2 first." })
  })

  it("names the first three missing, and counts the rest", () => {
    const missing = ["A", "B", "C", "D", "E"].map((label) => ({
      key: label,
      label,
    }))

    expect(
      exportProblem(defined("INCOMPLETE", { missing }), {
        format: "pdf",
        draftPath,
      }).message
    ).toBe("Fill in A, B, C and 2 more first.")
  })

  it("asks for an agreement first", () => {
    expect(
      exportProblem(defined("NO_DOCUMENT"), { format: "pdf", draftPath })
    ).toEqual({ message: "Pick an agreement first." })
  })

  it("says when the draft is gone", () => {
    expect(
      exportProblem(defined("NOT_FOUND"), { format: "pdf", draftPath })
    ).toEqual({ message: "We couldn't find that draft." })
  })

  it("says to try again when the file couldn't be made", () => {
    expect(
      exportProblem(defined("EXPORT_FAILED"), { format: "pdf", draftPath })
    ).toEqual({ message: "We couldn't make the file. Please try again." })
  })

  it("says to try again when the network failed", () => {
    expect(
      exportProblem(new TypeError("Failed to fetch"), {
        format: "pdf",
        draftPath,
      })
    ).toEqual({ message: "We couldn't make the file. Please try again." })
  })
})
