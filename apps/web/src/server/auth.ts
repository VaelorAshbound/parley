import {
  claimUnconfirmedAccount,
  moveGuestData,
  schema,
  type Db,
} from "@workspace/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { verifyJWT } from "better-auth/crypto"
import { betterAuth } from "better-auth/minimal"
// captcha and lastLoginMethod have no path of their own in 1.7.5.
import { captcha, lastLoginMethod } from "better-auth/plugins"
import { anonymous } from "better-auth/plugins/anonymous"
import { twoFactor } from "better-auth/plugins/two-factor"
import { createElement } from "react"

import { ChangeEmail } from "../emails/change-email"
import { ResetPassword } from "../emails/reset-password"
import { VerifyEmail } from "../emails/verify-email"

import { auditHooks } from "./audit"
import { createMailer } from "./email"
import {
  GUESTS_PER_NETWORK,
  PREVIEW_GUESTS_PER_NETWORK,
  TEST_GUESTS_PER_NETWORK,
} from "./limits"
import { log, logInfo } from "./log"

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
      // "Forgot password?": a single-use link that works for 30 minutes and
      // signs every device out (spec §5 Auth). Better Auth sends it after
      // the response (backgroundTasks), and answers the same for an address
      // with no account.
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        // Better Auth's own link puts the token in the path
        // (/reset-password/<token>), and Cloudflare's invocation log keeps
        // full paths (ADR-0005). Ours goes straight to the page, with the
        // token in the query, which the logs redact.
        const link = new URL("/reset-password", url)
        link.searchParams.set("token", token)
        await sendEmail({
          event: "reset_password",
          to: user.email,
          subject: "Reset your Parley password",
          react: createElement(ResetPassword, { url: link.href }),
          idempotencyKey: `reset-password/${user.id}/${await digest(token)}`,
        })
      },
      onPasswordReset: async ({ user }) => {
        // Only the owner of the inbox could open the link: their email is
        // confirmed. This is also the way back for someone whose address
        // another person signed up with and never confirmed: the reset ends
        // that person's sessions, replaces the password they chose, and
        // drops any two-factor sign-in they set up. (`user` is as it was
        // before the reset.)
        if (!user.emailVerified) await claimUnconfirmedAccount(db, user.id)
        logInfo("password_reset", { userId: user.id })
      },
    },
    user: {
      // Settings → Delete account (spec §5 Auth): the password, or for a
      // Google or GitHub account a sign-in in the last 15 minutes
      // (freshAge). The user row goes, and every draft, chat, session and
      // login with it (foreign keys cascade).
      deleteUser: { enabled: true },
      changeEmail: {
        enabled: true,
        // A confirmed address approves the move first; Better Auth then
        // sends the new address its own link (sendVerificationEmail), and
        // the email changes when that one is opened. An unconfirmed
        // account's link goes straight to the new address. Better Auth
        // answers the same, and sends nothing, when the new address already
        // has an account.
        sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) =>
          sendEmail({
            event: "change_email",
            to: user.email,
            subject: "Approve your new email for Parley",
            react: createElement(ChangeEmail, { url, newEmail }),
            idempotencyKey: `change-email/${user.id}/${await digest(token)}`,
          }),
      },
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
      // Deleting the account without a password, or adding a password to a
      // Google or GitHub account, needs a sign-in this recent (Better
      // Auth's default is a day). Changing a password asks for the current
      // one instead.
      freshAge: 15 * 60,
      // Saves a database read on most requests. A revoke can take up to
      // 5 minutes to reach other devices (spec §5 Auth).
      cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "compact" },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/verify-email")
          await newEmailNeedsItsAccount(ctx, env.BETTER_AUTH_SECRET)
        if (ctx.path === "/delete-user") await deleteNeedsThePassword(ctx)
      }),
    },
    // Who signed in, out, and changed what: IDs only (spec §5 Auth).
    databaseHooks: auditHooks(),
    // Memory would reset per isolate on Workers.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        // New guests per network (spec §2 Limits). Better Auth counts per
        // IP and path, before the Turnstile check.
        "/sign-in/anonymous": guestsPerNetwork(env),
      },
    },
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
 * A test deployment: local dev, the Worker tests and Previews, which run
 * with Turnstile's test keys (production has the real widget).
 */
function usesTestKeys(env: Pick<Env, "TURNSTILE_SECRET_KEY">) {
  return turnstileTestSecrets.has(env.TURNSTILE_SECRET_KEY)
}

/** How many new guests one network may make (spec §2 Limits). */
function guestsPerNetwork(env: Pick<Env, "STAGE" | "TURNSTILE_SECRET_KEY">) {
  if (!usesTestKeys(env)) return GUESTS_PER_NETWORK
  const stage: string = env.STAGE
  return stage === "preview"
    ? PREVIEW_GUESTS_PER_NETWORK
    : TEST_GUESTS_PER_NETWORK
}

/**
 * Turnstile before the routes a bot would hammer: making accounts and
 * guests, guessing passwords, and sending email (spec §5 Auth). With the
 * real widget, a token counts only if it was solved on Parley's domain, for
 * the "auth" action.
 */
function turnstile(env: Pick<Env, "STAGE" | "TURNSTILE_SECRET_KEY">) {
  return captcha({
    provider: "cloudflare-turnstile",
    secretKey: env.TURNSTILE_SECRET_KEY,
    endpoints: [
      "/sign-up/email",
      "/sign-in/email",
      // A guest gets AI messages: Turnstile once, before the first (spec §2
      // Limits).
      "/sign-in/anonymous",
      "/request-password-reset",
      "/send-verification-email",
      // An unconfirmed account's link goes to whatever address is typed.
      "/change-email",
    ],
    ...(!usesTestKeys(env) && {
      expectedAction: "auth",
      // Previews move from host to host; production has one.
      ...(env.STAGE === "production" && {
        allowedHostnames: [productionHost],
      }),
    }),
  })
}

/**
 * The link Better Auth sends to a new email address changes the email, and
 * signs in a browser that has no session. Anyone holding such a link (one
 * for their own account, or one sent to an address the user mistyped)
 * could then sign a stranger in to that account and see what the stranger
 * types there: login CSRF, which T21 closed for the confirm link. So this
 * link works only where the account is signed in; elsewhere it says to sign
 * in first, and still works afterwards (it lasts an hour).
 */
async function newEmailNeedsItsAccount(ctx: HookContext, secret: string) {
  const token: unknown = ctx.query?.token
  if (typeof token !== "string") return
  const payload = await verifyJWT<{ requestType?: unknown }>(token, secret)
  if (payload?.requestType !== "change-email-verification") return
  if (await getSessionFromCtx(ctx)) return
  // Back to the page that asked, as Better Auth sends its own errors. This
  // runs before its origin check, so it makes the same one (the settings
  // page sends a full URL), and redirects on this host only.
  const callbackURL: unknown = ctx.query?.callbackURL
  if (
    typeof callbackURL === "string" &&
    ctx.context.isTrustedOrigin(callbackURL, { allowRelativePaths: true })
  ) {
    const url = new URL(callbackURL, ctx.context.baseURL)
    url.searchParams.set("error", "SIGN_IN_FIRST")
    throw ctx.redirect(url.pathname + url.search)
  }
  throw APIError.from("UNAUTHORIZED", {
    code: "SIGN_IN_FIRST",
    message: "Sign in, then open the link again.",
  })
}

/**
 * Deleting an account that has a password always needs the password (spec
 * §5 Auth). Better Auth also takes a sign-in in the last 15 minutes
 * instead, which only a Google or GitHub account should get: otherwise
 * anyone at the user's browser in that time could delete the account.
 */
async function deleteNeedsThePassword(ctx: HookContext) {
  // Better Auth checks a password that is sent.
  const password: unknown = ctx.body?.password
  if (password) return
  // No session: Better Auth answers 401.
  const session = await getSessionFromCtx(ctx)
  if (!session) return
  const credential = await ctx.context.internalAdapter.findCredentialAccount(
    session.user.id
  )
  if (credential?.password)
    throw APIError.from("BAD_REQUEST", {
      code: "INVALID_PASSWORD",
      message: "Invalid password",
    })
}

/** What a Better Auth hook gets. */
type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

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
