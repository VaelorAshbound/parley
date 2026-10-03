// `pnpm dev`: everything a fresh clone needs to run Parley locally.
//
// 1. apps/web/.dev.vars: copied from .dev.vars.example on the first run,
//    with a new BETTER_AUTH_SECRET. An existing file is never touched.
// 2. Local Postgres 18 (`pnpm db:dev`, ADR-0004), unless one already runs on
//    its port. It stops with this script, and if it stops on its own, the
//    app is stopped too.
// 3. The app (`vp dev` in apps/web), on http://localhost:3000 or $PORT.

import { connect } from "node:net"
import { join } from "node:path"

import { runDev, setUpDevVars } from "./dev-run.ts"

const root = join(import.meta.dirname, "..")
const DB_PORT = 54320

try {
  if (setUpDevVars(join(root, "apps/web/.dev.vars")) === "created")
    console.log("Wrote apps/web/.dev.vars from .dev.vars.example.")
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

/** Something already listens on the port (an earlier `pnpm db:dev`). */
function listening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect(port, "localhost")
    socket.once("connect", () => resolve(!!socket.end()))
    socket.once("error", () => resolve(false))
  })
}

const ctrlC = new AbortController()
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => ctrlC.abort())

process.exitCode = await runDev({
  db: (await listening(DB_PORT))
    ? undefined
    : { command: "pnpm", args: ["db:dev"], cwd: root },
  app: { command: "pnpm", args: ["vp", "-C", "apps/web", "dev"], cwd: root },
  signal: ctrlC.signal,
})
