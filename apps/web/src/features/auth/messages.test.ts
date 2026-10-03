import { describe, expect, it } from "vite-plus/test"

import {
  authErrorMessage,
  emailLinkErrorMessage,
  needsNewSignIn,
  oauthErrorMessage,
  retryAfterOf,
  setupErrorMessage,
} from "./messages"

describe("authErrorMessage", () => {
  it("says to wait when rate limited, whatever the code", () => {
    expect(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 429 })
    ).toMatch(/wait/)
  })

  it("says how long to wait: Better Auth's limits last 10 seconds (PAR-20)", () => {
    // Sign-in, sign-up and each two-factor step: 3 tries per 10 s per IP.
    expect(authErrorMessage({ code: "INVALID_CODE", status: 429 })).toBe(
      "Too many tries. Please wait 10 seconds, then try again."
    )
  })

  it("says the wait the server gave: a minute for reset and confirmation emails (PAR-20)", () => {
    // /request-password-reset and /send-verification-email: 3 per 60 s.
    expect(authErrorMessage({ status: 429 }, { retryAfter: 60 })).toBe(
      "Too many tries. Please wait a minute, then try again."
    )
    expect(authErrorMessage({ status: 429 }, { retryAfter: 37 })).toBe(
      "Too many tries. Please wait a minute, then try again."
    )
    expect(authErrorMessage({ status: 429 }, { retryAfter: 7 })).toBe(
      "Too many tries. Please wait 10 seconds, then try again."
    )
    expect(authErrorMessage({ status: 429 }, { retryAfter: 600 })).toBe(
      "Too many tries. Please wait 10 minutes, then try again."
    )
  })

  it("reads the wait from X-Retry-After", () => {
    const limited = (value: string) =>
      new Response(null, { status: 429, headers: { "X-Retry-After": value } })

    expect(retryAfterOf(limited("60"))).toBe(60)
    expect(retryAfterOf(limited("soon"))).toBeUndefined()
    expect(retryAfterOf(new Response(null, { status: 429 }))).toBeUndefined()
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

  it.each(["TOTP_NOT_ENABLED", "BACKUP_CODES_NOT_ENABLED"])(
    "sends a code with no sign-in waiting for it back to sign-in (%s)",
    (code) => {
      // A guest's session on /two-factor: it has no two-factor (PAR-20).
      expect(authErrorMessage({ code, status: 400 })).toBe(
        "No sign-in is waiting for a code. Please sign in again."
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

  it("asks for the password and code when the account has two-factor on", () => {
    // Google and GitHub are never joined to it (server/two-factor.ts).
    expect(oauthErrorMessage("unable_to_link_account")).toMatch(
      /password and your code/
    )
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

describe("setupErrorMessage", () => {
  it("asks to start the setup again, not to sign in, when it was reset (PAR-20)", () => {
    // Settings → Turn on, while another tab turned two-factor off.
    expect(setupErrorMessage({ code: "TOTP_NOT_ENABLED", status: 400 })).toBe(
      "Two-factor setup was reset. Close this and start again."
    )
  })

  it("says the rest as authErrorMessage does", () => {
    expect(setupErrorMessage({ code: "INVALID_CODE", status: 401 })).toBe(
      authErrorMessage({ code: "INVALID_CODE", status: 401 })
    )
  })
})
