import { listSessions, sessionToken } from "@workspace/db"
import { APIError } from "better-auth/api"

import type { Auth } from "../auth"
import { z } from "../zod"
import { authed } from "./base"
import { describeDevice } from "./device"

// Account settings (T23) that Better Auth's own browser API doesn't cover
// well. The rest (name, email, password change, sign out everywhere, delete)
// the settings page calls on /api/auth directly, the documented way.

/** Signed-up users only: guests have no settings (they sign up first). */
const signedUp = authed.use(({ context, next, errors }) => {
  if (context.user.isAnonymous) throw errors.UNAUTHORIZED()
  return next()
})

/** Social sign-ins Parley offers (spec §5 Auth). */
const providers = ["google", "github"] as const
type Provider = (typeof providers)[number]
function isProvider(id: string): id is Provider {
  return providers.some((each) => each === id)
}

/**
 * Until when this session counts as a fresh sign-in: adding a password or
 * deleting the account without one needs it (Better Auth's freshAge).
 */
async function freshUntil(auth: Auth, session: { createdAt: Date }) {
  const { sessionConfig } = await auth.$context
  return new Date(session.createdAt.getTime() + sessionConfig.freshAge * 1000)
}

export const account = {
  /** How the user signs in, for the settings page. */
  get: signedUp.handler(async ({ context }) => {
    const accounts = await context.auth.api.listUserAccounts({
      headers: context.reqHeaders ?? new Headers(),
    })
    const ids = accounts.map((each) => each.providerId)
    return {
      hasPassword: ids.includes("credential"),
      providers: ids.filter(isProvider),
      freshUntil: await freshUntil(context.auth, context.session),
    }
  }),

  /**
   * The signed-in devices. Better Auth's /list-sessions sends every
   * session's token to the browser; a token is the session itself, so this
   * list has names and times only, and revokeSession finds the token here.
   */
  sessions: signedUp.handler(async ({ context }) => {
    const sessions = await listSessions(context.db, { userId: context.user.id })
    return sessions.map((each) => ({
      id: each.id,
      device: describeDevice(each.userAgent),
      createdAt: each.createdAt,
      lastActiveAt: each.updatedAt,
      current: each.id === context.session.id,
    }))
  }),

  /** Signs one of the user's devices out, through Better Auth (audited). */
  revokeSession: signedUp
    .input(z.object({ id: z.string().min(1).max(64) }))
    .handler(async ({ context, input, errors }) => {
      const token = await sessionToken(context.db, {
        id: input.id,
        userId: context.user.id,
      })
      if (!token)
        throw errors.NOT_FOUND({
          message: "That device is already signed out.",
        })
      await context.auth.api.revokeSession({
        body: { token },
        headers: context.reqHeaders ?? new Headers(),
      })
    }),

  /**
   * Adds a password to an account that signs in with Google or GitHub only.
   * Better Auth keeps this call server-side; like deleting the account, it
   * needs a fresh sign-in, so a borrowed browser can't add a way in.
   */
  setPassword: signedUp
    .errors({
      SESSION_NOT_FRESH: {
        message: "Please confirm it’s you by signing in again.",
      },
      PASSWORD_ALREADY_SET: {
        message: "You already have a password. Change it instead.",
      },
    })
    .input(z.object({ newPassword: z.string().min(10).max(128) }))
    .handler(async ({ context, input, errors }) => {
      const headers = context.reqHeaders ?? new Headers()
      // From the database, not the 5-minute cookie cache, like Better
      // Auth's own sensitive endpoints.
      const current = await context.auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      })
      if (!current) throw errors.UNAUTHORIZED()
      const fresh = await freshUntil(context.auth, current.session)
      if (Date.now() >= fresh.getTime()) throw errors.SESSION_NOT_FRESH()
      try {
        await context.auth.api.setPassword({
          body: { newPassword: input.newPassword },
          headers,
        })
      } catch (error) {
        if (
          error instanceof APIError &&
          error.body?.code === "PASSWORD_ALREADY_SET"
        )
          throw errors.PASSWORD_ALREADY_SET()
        throw error
      }
    }),
}
