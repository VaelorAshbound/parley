import { moveGuestData, schema, type Db } from "@workspace/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth/minimal"
// captcha and lastLoginMethod have no path of their own in 1.7.5.
import { captcha, lastLoginMethod } from "better-auth/plugins"
import { anonymous } from "better-auth/plugins/anonymous"
import { twoFactor } from "better-auth/plugins/two-factor"
import { createElement } from "react"

import { VerifyEmail } from "../emails/verify-email"

import { auditHooks } from "./audit"
import { createMailer } from "./email"
import { logInfo } from "./log"

import { log } from "./log"

// Better Auth, built per request because the database client is per request
// (spec §5 Auth).

/**
 * The hosts Parley answers on. Better Auth builds its base URL from the
 * request's host when it is on this list, and refuses any other host.
 * Production refuses workers.dev: old versions stay reachable there and must
 * not act on production data. https://better-auth.com/docs/reference/options#baseurl
 */
const productionHost = "parley.runtimedrift.dev"

export function allowedHosts(stage: string) {
  return stage === "preview"
    ? // Worker Previews (T3); they have their own database branch.
      ["*-parley.vaelorashbound.workers.dev", "localhost:*"]
    : // `pnpm dev` and the Worker tests run with the production vars.
      [productionHost, "localhost:*"]
}

export function createAuth({
  db,
  env,
  waitUntil,
}: {
  db: Db
  env: Pick<Env, "BETTER_AUTH_SECRET" | "STAGE" | "TURNSTILE_SECRET_KEY"> & {
    /** Missing on Previews and in local dev: no email is sent there. */
    RESEND_API_KEY?: string | undefined
  } & OAuthApps
  /** ctx.waitUntil: work that may finish after the response. */
  waitUntil: (promise: Promise<unknown>) => void
}) {
  const sendEmail = createMailer(env)

  return betterAuth({
    appName: "Parley",
    // Better Auth's own error and warning lines, through our structured
    // logger (T29). Its default prints the whole error, and a failed query's
    // message holds the bound values (session tokens, emails). Its messages
    // are fixed text, some ending with a value after a colon or in quotes (a
    // URL, a provider): only the text before that is kept.
    logger: {
      log: (level, message, ...args: unknown[]) =>
        log(
          level === "error" || level === "warn" ? level : "info",
          "auth_log",
          { message: message.split(/[:"'`\n]/)[0]?.trim() },
          args.find((each) => each instanceof Error)
        ),
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: { allowedHosts: allowedHosts(env.STAGE), protocol: "auto" },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    // Google and GitHub, where their apps are set up (spec §5 Auth).
    socialProviders: socialProviders(env),
    account: {
      // Better Auth joins a Google or GitHub sign-in to the account with
      // the same email only when both sides confirmed that email (its
      // default), so nobody can claim an address first and wait.
      accountLinking: { enabled: true },
      // Parley never calls Google or GitHub for the user: if the database
      // leaks, the stored tokens are useless.
      encryptOAuthTokens: true,
    },
    emailVerification: {
      // Signing up gives a session at once, so the guest's draft links right
      // away; export, share and upgrade wait for this (spec §5 Auth).
      sendOnSignUp: true,
      // Never sign in from the link: the anonymous plugin links on any new
      // session, so a guest who opened someone else's link would be signed
      // in as them and hand over their drafts (login CSRF). Sign-up already
      // signed the user in; on another device they sign in as usual.
      autoSignInAfterVerification: false,
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
    // Who signed in, out, and changed what: IDs only (spec §5 Auth).
    databaseHooks: auditHooks(),
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
      turnstile(env),
      // A cookie only: "Last used" on the sign-in buttons.
      lastLoginMethod(),
      // No tanstackStartCookies() (spec §5 Auth asked for it; T21 found it
      // does nothing here and breaks things): sign-in, sign-up and sign-out
      // go through /api/auth, whose responses carry their own cookies, and
      // the two server-side session reads (getViewer, the oRPC `authed`
      // base) copy refreshed cookies themselves. The plugin would import
      // Start's server runtime on every auth call, also from Hono and the
      // Worker tests, where there is no Start request to set cookies on.
    ],
  })
}

/**
 * OAuth apps. Production has its own; local dev uses the "(dev)" GitHub app
 * (GitHub allows one callback URL per app) and the shared Google client.
 * Previews have none: their hosts change, so no callback URL can match.
 */
type OAuthApps = {
  [key in `${"GOOGLE" | "GITHUB"}_CLIENT_${"ID" | "SECRET"}`]?:
    | string
    | undefined
}

function socialProviders(env: OAuthApps) {
  const google = app(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
  const github = app(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET)
  return {
    // People often have a work and a personal Google account.
    ...(google && { google: { ...google, prompt: "select_account" as const } }),
    ...(github && { github }),
  }
}

function app(clientId?: string, clientSecret?: string) {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined
}

/**
 * Cloudflare's test secrets ("always passes", "always fails", "already
 * spent"), used in local dev, tests and Previews. They only accept the dummy
 * token, which reports hostname "localhost" and action "test".
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const turnstileTestSecrets = new Set(
  ["1x", "2x", "3x"].map((kind) => `${kind}0000000000000000000000000000000AA`)
)

/**
 * Turnstile before the routes a bot would hammer: making accounts, guessing
 * passwords, and sending email (spec §5 Auth). With the real widget, a token
 * counts only if it was solved on Parley's domain, for the "auth" action.
 * T27 adds the guest sign-in (/sign-in/anonymous).
 */
function turnstile(env: Pick<Env, "STAGE" | "TURNSTILE_SECRET_KEY">) {
  const real = !turnstileTestSecrets.has(env.TURNSTILE_SECRET_KEY)
  return captcha({
    provider: "cloudflare-turnstile",
    secretKey: env.TURNSTILE_SECRET_KEY,
    endpoints: [
      "/sign-up/email",
      "/sign-in/email",
      "/request-password-reset",
      "/send-verification-email",
    ],
    ...(real && {
      expectedAction: "auth",
      // Previews move from host to host; production has one.
      ...(env.STAGE === "production" && {
        allowedHostnames: [productionHost],
      }),
    }),
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
