import { describe, expect, it } from "vite-plus/test"

import { authErrorMessage, oauthErrorMessage } from "./messages"

describe("authErrorMessage", () => {
  it("says to wait when rate limited, whatever the code", () => {
    expect(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 429 })
    ).toMatch(/wait/)
  })

  it("never says which half of the sign-in was wrong", () => {
    expect(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })
    ).toBe("That email and password don’t match.")
  })

  it("points a known email to sign-in", () => {
    expect(
      authErrorMessage({ code: "USER_ALREADY_EXISTS", status: 422 })
    ).toMatch(/Sign in instead/)
  })

  it("explains a failed Turnstile check", () => {
    expect(authErrorMessage({ code: "VERIFICATION_FAILED", status: 403 })).toBe(
      "We couldn’t check that you’re a person. Please try again."
    )
  })

  it("has a friendly fallback for anything else", () => {
    expect(authErrorMessage({ status: 500 })).toBe(
      "Something went wrong. Please try again."
    )
  })
})

describe("oauthErrorMessage", () => {
  it("explains why Google or GitHub didn't join an existing account", () => {
    expect(oauthErrorMessage("account_not_linked")).toMatch(
      /confirm your email/
    )
  })
})
