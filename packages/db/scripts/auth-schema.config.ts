// Only for `pnpm db:auth-schema`: the Better Auth CLI reads this to write
// src/auth-schema.ts. It lists every option that adds tables or columns
// (spec §5 Auth). The app's real config (apps/web/src/server/auth.ts, T14)
// must produce the same schema; a test there checks it.
import { betterAuth } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { anonymous } from "better-auth/plugins/anonymous"
import { twoFactor } from "better-auth/plugins/two-factor"

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  rateLimit: { storage: "database" },
  plugins: [anonymous(), twoFactor()],
})
