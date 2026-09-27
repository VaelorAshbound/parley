import { describe, expect, it } from "vite-plus/test"

import {
  authErrorMessage,
  emailLinkErrorMessage,
  needsNewSignIn,
  oauthErrorMessage,
} from "./messages"

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

  it("says the current password is wrong in settings", () => {
    expect(authErrorMessage({ code: "INVALID_PASSWORD", status: 400 })).toBe(
      "That password isn’t right."
    )
  })

  it("says a reset link no longer works, and what to do", () => {
    expect(authErrorMessage({ code: "INVALID_TOKEN", status: 400 })).toBe(
      "This link has expired or was already used. Ask for a new one."
    )
  })

  it("asks to sign in again before a sensitive change", () => {
    expect(authErrorMessage({ code: "SESSION_EXPIRED", status: 400 })).toBe(
      "For your safety, please sign in again first."
    )
  })

  it("says a code from the authenticator app is wrong", () => {
    expect(authErrorMessage({ code: "INVALID_CODE", status: 401 })).toBe(
      "That code isn’t right. Check the app and try again."
    )
  })

  it("says a backup code is wrong or was used", () => {
    expect(authErrorMessage({ code: "INVALID_BACKUP_CODE", status: 401 })).toBe(
      "That backup code isn’t right, or it was used already."
    )
  })

  it("says how long a locked account waits, not just a minute", () => {
    expect(
      authErrorMessage({ code: "ACCOUNT_TEMPORARILY_LOCKED", status: 429 })
    ).toBe("Too many wrong codes. Please try again in 15 minutes.")
  })

  it.each(["INVALID_TWO_FACTOR_COOKIE", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"])(
    "asks to sign in again when the code step is over (%s)",
    (code) => {
      expect(authErrorMessage({ code, status: 401 })).toMatch(
        /Please sign in again\.$/
      )
      expect(needsNewSignIn(code)).toBe(true)
    }
  )

  it("keeps the code step for a wrong code", () => {
    expect(needsNewSignIn("INVALID_CODE")).toBe(false)
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

  it("offers the way back to someone who doesn't know that password", () => {
    expect(oauthErrorMessage("account_not_linked")).toMatch(/Forgot password/)
  })
})

describe("emailLinkErrorMessage", () => {
  it("asks to sign in before opening the new address's link", () => {
    expect(emailLinkErrorMessage("SIGN_IN_FIRST")).toBe(
      "Sign in here first, then open the link in the email again."
    )
  })

  it("says the link belongs to another account", () => {
    expect(emailLinkErrorMessage("INVALID_USER")).toMatch(/another account/)
  })

  it("says an old link no longer works", () => {
    expect(emailLinkErrorMessage("TOKEN_EXPIRED")).toBe(
      "This link has expired. Please ask for a new one."
    )
  })
})
