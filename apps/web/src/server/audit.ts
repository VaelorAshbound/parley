import type { BetterAuthOptions } from "better-auth/minimal"

import { logInfo } from "./log"

// Audit lines for the security events on an account (spec §5 Auth, T23),
// written by Better Auth's database hooks, so every way in (email, Google,
// GitHub, a guest, a reset link) is covered by one piece of code. They are
// log events in Workers Logs like every other event (ADR-0006), and hold IDs
// and fixed names only: never an email, a name, a password or a token.

type Hooks = NonNullable<BetterAuthOptions["databaseHooks"]>

/** Login methods: Better Auth's provider ids we turn on (a fixed set). */
const methods = new Set(["credential", "google", "github"])

export function auditHooks(): Hooks {
  // An update's before and after hooks get the same endpoint context: the
  // before hook sees which fields change, the after hook sees the saved row
  // (Better Auth 1.7 gives it no old row to compare with).
  const changingEmail = new WeakSet<object>()
  const changingPassword = new WeakSet<object>()

  return {
    session: {
      create: {
        after: async (session) =>
          logInfo("session_created", {
            userId: session.userId,
            sessionId: session.id,
          }),
      },
      delete: {
        // Signed out, revoked, or found expired.
        after: async (session) =>
          logInfo("session_ended", {
            userId: session.userId,
            sessionId: session.id,
          }),
      },
    },
    account: {
      create: {
        after: async (account) =>
          logInfo("login_method_added", {
            userId: account.userId,
            method: methods.has(account.providerId)
              ? account.providerId
              : "other",
          }),
      },
      update: {
        before: async (data, ctx) => {
          if (ctx && typeof data.password === "string")
            changingPassword.add(ctx)
        },
        after: async (account, ctx) => {
          if (ctx && changingPassword.has(ctx))
            logInfo("password_changed", { userId: account.userId })
        },
      },
    },
    user: {
      update: {
        before: async (data, ctx) => {
          if (ctx && typeof data.email === "string") changingEmail.add(ctx)
        },
        after: async (user, ctx) => {
          if (ctx && changingEmail.has(ctx))
            logInfo("email_changed", { userId: user.id })
        },
      },
      delete: {
        after: async (user) =>
          logInfo("user_deleted", {
            userId: user.id,
            guest: user.isAnonymous === true,
          }),
      },
    },
  }
}
