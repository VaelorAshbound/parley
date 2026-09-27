import { describe, expect, it } from "vite-plus/test"

import { billingProblem } from "./problem"

describe("billingProblem", () => {
  it("asks for a confirmed email, with a new link back to Pricing", () => {
    expect(billingProblem({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toEqual(
      {
        message: "Confirm your email first, then upgrade. We sent you a link.",
        action: {
          label: "Get a new link",
          href: "/verify-email?redirect=%2Fpricing",
        },
      }
    )
  })

  it("says a Pro account already has Pro", () => {
    expect(billingProblem({ code: "ALREADY_PRO", status: 409 })).toEqual({
      message: "You already have Pro.",
    })
  })

  it("says there is no billing before the first upgrade", () => {
    expect(billingProblem({ code: "NO_BILLING", status: 404 })).toEqual({
      message: "There is no billing yet. It starts when you upgrade.",
      action: { label: "See Pro", href: "/pricing" },
    })
  })

  it("asks a signed-out visitor to sign in, back to Pricing", () => {
    expect(billingProblem({ code: "UNAUTHORIZED", status: 401 })).toEqual({
      message: "Sign in to upgrade.",
      action: { label: "Sign in", href: "/sign-in?redirect=%2Fpricing" },
    })
  })

  it("asks for a short wait after too many tries", () => {
    expect(billingProblem({ status: 429 })).toEqual({
      message: "Too many tries. Please wait a minute, then try again.",
    })
  })

  it("blames Polar, not the user, for anything else", () => {
    for (const error of [
      { status: 500 },
      { code: "INVALID_CHECKOUT", status: 400 },
      { status: 503 },
    ])
      expect(billingProblem(error)).toEqual({
        message: "Polar, our payment service, didn’t answer. Please try again.",
      })
  })
})
