// Plain words for what Better Auth answers. Its own messages are for
// developers ("User already exists."); these tell people what to do next.

/** A failed auth call, as the Better Auth client reports it. */
export type AuthError = { code?: string | undefined; status: number }

export function authErrorMessage(error: AuthError) {
  if (error.status === 429)
    return "Too many tries. Please wait a minute, then try again."
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don’t match."
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "This email already has an account. Sign in instead."
    case "PASSWORD_TOO_SHORT":
      return "Use at least 10 characters for your password."
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters for your password."
    case "INVALID_EMAIL":
      return "Please enter a valid email."
    // Turnstile (Better Auth's captcha plugin).
    case "MISSING_RESPONSE":
    case "VERIFICATION_FAILED":
      return "We couldn’t check that you’re a person. Please try again."
    default:
      return "Something went wrong. Please try again."
  }
}

/** `?error=` after Google or GitHub sends the user back. */
export function oauthErrorMessage(code: string) {
  return code === "account_not_linked"
    ? "This email already has a Parley account. Sign in with your password and confirm your email; then Google and GitHub work too."
    : "Signing in didn’t work. Please try again."
}

/** `?error=` after a confirmation link that no longer works. */
export function verifyLinkErrorMessage(code: string) {
  return code === "token_expired" || code === "invalid_token"
    ? "This link has expired or was already used."
    : "We couldn’t confirm your email with this link."
}
