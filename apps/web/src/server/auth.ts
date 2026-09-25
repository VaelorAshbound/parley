import { moveGuestData, schema, type Db } from "@workspace/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth/minimal"
import { anonymous } from "better-auth/plugins/anonymous"
import { twoFactor } from "better-auth/plugins/two-factor"
import { createElement } from "react"

import { VerifyEmail } from "../emails/verify-email"

import { createMailer } from "./email"
import { logInfo } from "./log"

// Better Auth, built per request because the database client is per request
// (spec §5 Auth).

/**
 * The hosts Parley answers on. Better Auth builds its base URL from the
 * request's host when it is on this list, and refuses any other host.
 * Production refuses workers.dev: old versions stay reachable there and must
 * not act on production data. https://better-auth.com/docs/reference/options#baseurl
 */
export function allowedHosts(stage: string) {
  return stage === "preview"
    ? // Worker Previews (T3); they have their own database branch.
      ["*-parley.vaelorashbound.workers.dev", "localhost:*"]
    : // `pnpm dev` and the Worker tests run with the production vars.
      ["parley.runtimedrift.dev", "localhost:*"]
}

export function createAuth({
  db,
  env,
  waitUntil,
}: {
  db: Db
  env: Pick<Env, "BETTER_AUTH_SECRET" | "STAGE"> & {
    /** Missing on Previews and in local dev: no email is sent there. */
    RESEND_API_KEY?: string | undefined
  }
  /** ctx.waitUntil: work that may finish after the response. */
  waitUntil: (promise: Promise<unknown>) => void
}) {
  const sendEmail = createMailer(env)

  return betterAuth({
    appName: "Parley",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: { allowedHosts: allowedHosts(env.STAGE), protocol: "auto" },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    emailVerification: {
      // Signing up gives a session at once, so the guest's draft links right
      // away; export, share and upgrade wait for this (spec §5 Auth).
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        // After the response, on every path (resend awaits this): the reply
        // is as fast for a new address as for a known one, and a slow Resend
        // never holds up sign-up.
        waitUntil(
          sendEmail({
            event: "verify_email",
            to: user.email,
            subject: "Confirm your email for Parley",
            react: createElement(VerifyEmail, { url }),
            idempotencyKey: `verify-email/${user.id}/${await digest(token)}`,
          })
        )
      },
    },
    session: {
      // Saves a database read on most requests. A revoke can take up to
      // 5 minutes to reach other devices (spec §5 Auth).
      cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "compact" },
    },
    // Memory would reset per isolate on Workers.
    rateLimit: { enabled: true, storage: "database" },
    advanced: {
      useSecureCookies: true,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: { handler: waitUntil },
    },
    plugins: [
      // Guests: the first action that needs a session signs in anonymously.
      anonymous({
        // A guest signed up or signed in (email, Google, GitHub). Better
        // Auth deletes the guest right after this, and the drafts would go
        // with it (cascade): move them first. If this throws, the guest and
        // its drafts stay, and the user can try again.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const { drafts } = await moveGuestData(db, {
            from: anonymousUser.user.id,
            to: newUser.user.id,
          })
          logInfo("guest_linked", {
            guestId: anonymousUser.user.id,
            userId: newUser.user.id,
            drafts,
          })
        },
      }),
      // Listed now because its tables are in the first migration; the
      // settings screen comes in T23b.
      twoFactor({ issuer: "Parley" }),
    ],
  })
}

/** A short one-way name for a token, so a key never holds the token. */
async function digest(token: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )
  return Array.from(new Uint8Array(bytes).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth["$Infer"]["Session"]
