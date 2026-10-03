import { schema } from "@workspace/db"
import type { BetterAuthOptions } from "better-auth"
import { getSchema } from "better-auth/db"
import { DrizzleQueryError, getTableColumns, is } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vite-plus/test"

import { allowedHosts, createAuth } from "./auth"
import { RATE_LIMIT_KEEP_HOURS } from "./cron"

const auth = createAuth({
  db: drizzle.mock({ schema }),
  env: {
    BETTER_AUTH_SECRET: "x".repeat(32),
    STAGE: "production",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  } as Env,
  waitUntil: () => {},
})

describe("the auth config", () => {
  // packages/db/src/auth-schema.ts is generated from a CLI config
  // (pnpm db:auth-schema); this proves the real config needs nothing more.
  it("finds every table and column it needs in the database schema", () => {
    const tables: Record<string, unknown> = schema

    for (const [model, { fields }] of Object.entries(getSchema(auth.options))) {
      const table = tables[model]
      expect(is(table, PgTable), `table ${model}`).toBe(true)
      const columns = Object.keys(getTableColumns(table as PgTable))
      for (const field of ["id", ...Object.keys(fields)])
        expect(columns, `${model}.${field}`).toContain(field)
    }
  })

  it("serves production on its own domain only, never on workers.dev", () => {
    expect(allowedHosts("production")).toEqual([
      "parley.runtimedrift.dev",
      "localhost:*",
    ])
  })

  it("serves previews on workers.dev", () => {
    expect(allowedHosts("preview")).toEqual([
      "*-parley.vaelorashbound.workers.dev",
      "localhost:*",
    ])
  })
})

describe("the nightly purge of rate_limit rows", () => {
  /** Every window (seconds) Better Auth counts in, as it reads the config. */
  function windows(options: BetterAuthOptions) {
    const rateLimit = options.rateLimit ?? {}
    const custom = Object.values(rateLimit.customRules ?? {}).flatMap((rule) =>
      rule && typeof rule === "object" ? [rule.window] : []
    )
    const fromPlugins = (options.plugins ?? []).flatMap((plugin) =>
      (plugin.rateLimit ?? []).map((rule) => rule.window)
    )
    // Better Auth's own rules for sign-in, sign-up and the like are 10 and
    // 60 seconds; its default window is 10.
    return [rateLimit.window ?? 10, 60, ...custom, ...fromPlugins]
  }

  it("keeps a row many times longer than the longest window, in production too", () => {
    // Production has the real Turnstile secret, and the 1-hour guest rule.
    const production = createAuth({
      db: drizzle.mock({ schema }),
      env: {
        BETTER_AUTH_SECRET: "x".repeat(32),
        STAGE: "production",
        TURNSTILE_SECRET_KEY: "0x4AAAAAAA-not-a-test-secret",
      } as Env,
      waitUntil: () => {},
    })
    const longest = Math.max(...windows(production.options))

    expect(longest).toBe(60 * 60)
    expect(RATE_LIMIT_KEEP_HOURS * 60 * 60).toBeGreaterThanOrEqual(10 * longest)
  })
})

// Better Auth logs a failed query's whole error, and some of its messages
// end with a URL or a value (T29: no field values in logs).
describe("Better Auth's logs", () => {
  const log = auth.options.logger?.log

  it("are structured lines with the error's name and code, not its message", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {})
    const failed = new DrizzleQueryError(
      'select * from "session" where "token" = $1',
      ["session-token-123"],
      Object.assign(new Error("gone"), { code: "08006" })
    )

    log?.("error", "INTERNAL_SERVER_ERROR", failed)

    expect(error.mock.calls).toEqual([
      [
        {
          level: "error",
          event: "auth_log",
          message: "INTERNAL_SERVER_ERROR",
          error: { name: "DrizzleQueryError", code: "08006", cause: "Error" },
        },
      ],
    ])
  })

  it("keep a message's fixed text, not the value after it", () => {
    using warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    log?.("warn", "Invalid redirect URL: https://evil.example/?token=abc")
    log?.("warn", 'Provider "acme" skipped')
    log?.("warn", "Failed query: select 1\nparams: Acme Secret")

    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      { level: "warn", event: "auth_log", message: "Invalid redirect URL" },
      { level: "warn", event: "auth_log", message: "Provider" },
      { level: "warn", event: "auth_log", message: "Failed query" },
    ])
  })
})
