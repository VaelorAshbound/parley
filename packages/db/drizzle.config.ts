import { defineConfig } from "drizzle-kit"

// Migrations always run over a direct, unpooled URL: never the Neon pooler
// or Hyperdrive, which pool in transaction mode (spec §5 Database). There is
// no default, so a migration can't hit a database by accident:
//   DATABASE_URL=<direct url> pnpm db:migrate
// Local dev and tests migrate on their own (scripts/dev.ts, test/setup.ts).
const url = process.env.DATABASE_URL

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/auth-schema.ts", "./src/schema.ts"],
  // scripts/check-drift.ts generates into a scratch copy.
  out: process.env.DRIZZLE_OUT ?? "./migrations",
  strict: true,
  verbose: true,
  ...(url ? { dbCredentials: { url } } : {}),
})
