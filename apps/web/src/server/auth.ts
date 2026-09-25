import { schema, type Db } from "@workspace/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth/minimal"
import { anonymous } from "better-auth/plugins/anonymous"
import { twoFactor } from "better-auth/plugins/two-factor"

import { log } from "./log"

// Better Auth, built per request because the database client is per request
// (spec §5 Auth). T21 adds email + password, OAuth and emails; T27 Turnstile.

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
  env: Pick<Env, "BETTER_AUTH_SECRET" | "STAGE">
  /** ctx.waitUntil: work that may finish after the response. */
  waitUntil: (promise: Promise<unknown>) => void
}) {
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
      // Guests: the first visit that needs a session signs in anonymously.
      // T21 moves a guest's drafts on sign-up (onLinkAccount).
      anonymous(),
      // Listed now because its tables are in the first migration; the
      // settings screen comes in T23b.
      twoFactor({ issuer: "Parley" }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth["$Infer"]["Session"]
