// Plain words for what Better Auth answers. Its own messages are for
// developers ("User already exists."); these tell people what to do next.

/** A failed auth call, as the Better Auth client reports it. */
export type AuthError = { code?: string | undefined; status: number }

/** Turnstile didn't finish in the browser, or the server refused it. */
export const humanCheckFailed =
  "We couldn’t check that you’re a person. Please try again."

/**
 * A 429's X-Retry-After in seconds (Better Auth sets it), for
 * authErrorMessage. Read it in the call's `onError({ response })`.
 */
export function retryAfterOf(response: Response) {
  const seconds = Number(response.headers.get("X-Retry-After") ?? Number.NaN)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

/** How long to wait, in words, rounded up. */
function waitFor(seconds: number) {
  if (seconds <= 10) return "10 seconds"
  if (seconds <= 60) return "a minute"
  return `${Math.ceil(seconds / 60)} minutes`
}

export function authErrorMessage(
  error: AuthError,
  { retryAfter }: { retryAfter?: number | undefined } = {}
) {
  // Also a 429, but for 15 minutes (Better Auth's twoFactor lockout).
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED")
    return "Too many wrong codes. Please try again in 15 minutes."
  // Better Auth's windows: 3 tries per 10 s per network for sign-in,
  // sign-up, password and email changes and each two-factor step; 3 per
  // 60 s for a reset or confirmation email (those pages pass retryAfter);
  // 100 per 10 s for the rest. Without retryAfter, 10 s is the window.
  if (error.status === 429)
    return `Too many tries. Please wait ${waitFor(retryAfter ?? 10)}, then try again.`
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
    // Settings: the current password, before a change or delete.
    case "INVALID_PASSWORD":
      return "That password isn’t right."
    // A reset link that expired or was used.
    case "INVALID_TOKEN":
      return "This link has expired or was already used. Ask for a new one."
    // Deleting without a password needs a recent sign-in (freshAge).
    case "SESSION_EXPIRED":
    case "SESSION_NOT_FRESH":
      return "For your safety, please sign in again first."
    // Turnstile (Better Auth's captcha plugin).
    case "MISSING_RESPONSE":
    case "VERIFICATION_FAILED":
      return humanCheckFailed
    // Two-factor sign-in (T23b): the code step, and turning it on.
    case "INVALID_CODE":
      return "That code isn’t right. Check the app and try again."
    case "INVALID_BACKUP_CODE":
      return "That backup code isn’t right, or it was used already."
    case "INVALID_TWO_FACTOR_COOKIE":
      return "Your sign-in timed out. Please sign in again."
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "Too many wrong codes. Please sign in again."
    // A code sent from a session with no two-factor: a guest's, on
    // /two-factor without a password step first (PAR-20).
    case "TOTP_NOT_ENABLED":
    case "BACKUP_CODES_NOT_ENABLED":
      return "No sign-in is waiting for a code. Please sign in again."
    default:
      return "Something went wrong. Please try again."
  }
}

/**
 * Settings → Two-factor → Turn on. A TOTP_NOT_ENABLED there means the
 * setup was undone (turned off in another tab), not that a sign-in waits:
 * signing in again wouldn't help.
 */
export function setupErrorMessage(error: AuthError) {
  return error.code === "TOTP_NOT_ENABLED"
    ? "Two-factor setup was reset. Close this and start again."
    : authErrorMessage(error)
}

/**
 * The code step is over (it lasts 10 minutes and takes 5 wrong codes), or
 * never began: the next try starts again from the password.
 */
export function needsNewSignIn(code: string | undefined) {
  return (
    code === "INVALID_TWO_FACTOR_COOKIE" ||
    code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" ||
    code === "TOTP_NOT_ENABLED" ||
    code === "BACKUP_CODES_NOT_ENABLED"
  )
}

/** `?error=` after Google or GitHub sends the user back. */
export function oauthErrorMessage(code: string) {
  switch (code) {
    case "account_not_linked":
      return "This email already has a Parley account. Sign in with your password and confirm your email; then Google and GitHub work too. Don’t know the password? Use “Forgot password?”."
    // Refused to join an account with two-factor on (server/two-factor.ts).
    case "unable_to_link_account":
      return "This email’s Parley account uses two-factor sign-in. Sign in with your password and your code."
    default:
      return "Signing in didn’t work. Please try again."
  }
}

/**
 * `?error=` on /settings after a link from a change-email email (Better
 * Auth's codes, and SIGN_IN_FIRST from server/auth.ts).
 */
export function emailLinkErrorMessage(code: string) {
  switch (code) {
    case "SIGN_IN_FIRST":
      return "Sign in here first, then open the link in the email again."
    case "INVALID_USER":
      return "This link is for another account. Sign out, then open it again."
    case "TOKEN_EXPIRED":
      return "This link has expired. Please ask for a new one."
    default:
      return "This link doesn’t work. Please ask for a new one."
  }
}

/** `?error=` after a confirmation link that no longer works. */
export function verifyLinkErrorMessage(code: string) {
  return code === "token_expired" || code === "invalid_token"
    ? "This link has expired or was already used."
    : "We couldn’t confirm your email with this link."
}
