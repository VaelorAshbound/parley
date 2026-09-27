import { forgetTrustedDevices, type Db } from "@workspace/db"
import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { expireCookie } from "better-auth/cookies"
import { twoFactor } from "better-auth/plugins/two-factor"

// Two-factor sign-in (spec §5 Auth, T23b): an authenticator app (TOTP) and
// 10 single-use backup codes, through Better Auth's twoFactor plugin. Only
// accounts with a password can turn it on, and it guards the password
// sign-in: Google and GitHub have their own second step, and Better Auth
// doesn't gate them ("Non-credential methods like OAuth … are not gated by
// 2FA by default", https://better-auth.com/docs/plugins/2fa).

/**
 * How long the code step may take after the password (Better Auth's
 * default), and how long a guest is carried through it.
 */
const challengeMaxAge = 10 * 60

/** "Trust this device for 30 days" on the code step. */
const trustDeviceMaxAge = 30 * 24 * 60 * 60

/** Carries a guest's id from the password step to the code step. */
const guestCookie = "guest_carried"

/** The code steps that end in a session. */
const codeSteps = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
])

/**
 * Better Auth's twoFactor plugin. List it, then twoFactorGuests, before the
 * anonymous plugin: Better Auth runs plugins' after hooks in the order they
 * are listed, and the anonymous plugin must see the password step's result
 * as it leaves twoFactor's hook.
 */
export function twoFactorSignIn() {
  return twoFactor({
    issuer: "Parley",
    twoFactorCookieMaxAge: challengeMaxAge,
    trustDeviceMaxAge,
  })
}

/**
 * A guest who signs in to an account with two-factor on keeps their work,
 * but only once the code is right. After the password, twoFactor's hook
 * ends the new session, so the anonymous plugin (after it) links nothing:
 * someone with the password alone can't put drafts in the account. This
 * remembers the guest in a signed cookie, and moves their work when a code
 * step signs in. The guest's own session cookie is gone by then (twoFactor
 * clears the session cookie), so this is the only way back to them.
 *
 * Turning two-factor off also forgets every trusted device, not only the
 * one that asked (Better Auth's default): turned on again later, it asks
 * for a code everywhere.
 */
export function twoFactorGuests({
  db,
  linkGuest,
}: {
  db: Db
  /** Moves a guest's work to the account; the guest is deleted after. */
  linkGuest: (guestId: string, userId: string) => Promise<void>
}) {
  return {
    id: "parley-two-factor",
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            if (!isChallenge(ctx.context.returned)) return
            const guest = await getSessionFromCtx(ctx, { disableRefresh: true })
            if (!guest?.user.isAnonymous) return
            const cookie = ctx.context.createAuthCookie(guestCookie, {
              maxAge: challengeMaxAge,
            })
            await ctx.setSignedCookie(
              cookie.name,
              guest.user.id,
              ctx.context.secret,
              cookie.attributes
            )
          }),
        },
        {
          matcher: (ctx) => codeSteps.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const cookie = ctx.context.createAuthCookie(guestCookie)
            const guestId = await ctx.getSignedCookie(
              cookie.name,
              ctx.context.secret
            )
            // A wrong code signs nothing in: the guest waits for the next.
            const signedIn = ctx.context.newSession
            if (!guestId || !signedIn) return
            expireCookie(ctx, cookie)
            // Only a sign-in's code step, which comes with no session (the
            // password step cleared it). A code checked while signed in is
            // turning two-factor on: nobody signed in here.
            const before = await getSessionFromCtx(ctx, {
              disableRefresh: true,
            })
            if (before && before.user.isAnonymous !== true) return
            if (signedIn.user.id === guestId) return
            const guest =
              await ctx.context.internalAdapter.findUserById(guestId)
            // The adapter's user type knows no plugin fields.
            if (!guest || !("isAnonymous" in guest) || !guest.isAnonymous)
              return
            await linkGuest(guestId, signedIn.user.id)
            await ctx.context.internalAdapter.deleteUser(guestId)
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/two-factor/disable",
          handler: createAuthMiddleware(async (ctx) => {
            // Set only when it worked: the session is renewed with the
            // user's two-factor off.
            const user = ctx.context.newSession?.user
            if (user && !user.twoFactorEnabled)
              await forgetTrustedDevices(db, user.id)
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}

/** The password step's answer when a code is needed next. */
function isChallenge(returned: unknown) {
  return (
    typeof returned === "object" &&
    returned !== null &&
    "twoFactorRedirect" in returned &&
    returned.twoFactorRedirect === true
  )
}
