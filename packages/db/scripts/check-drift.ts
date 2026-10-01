// CI: fails when src/*schema.ts changed without a new migration. drizzle-kit
// has no dry run, so generate into a scratch copy of migrations/ and compare.
import { execFileSync } from "node:child_process"
import { cpSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
// drizzle-kit only takes an output folder relative to the package.
const scratch = "node_modules/.cache/drift"
rmSync(join(root, scratch), { recursive: true, force: true })
cpSync(join(root, "migrations"), join(root, scratch), { recursive: true })
try {
  const before = readdirSync(join(root, scratch)).length
  execFileSync("drizzle-kit", ["generate"], {
    cwd: root,
    env: { ...process.env, DRIZZLE_OUT: scratch },
    stdio: ["ignore", "ignore", "inherit"],
  })
  if (readdirSync(join(root, scratch)).length !== before) {
    console.error(
      "The schema changed but has no migration. Run `pnpm db:generate`."
    )
    process.exitCode = 1
  } else {
    console.log("Migrations match the schema.")
  }
} finally {
  rmSync(join(root, scratch), { recursive: true, force: true })
}
