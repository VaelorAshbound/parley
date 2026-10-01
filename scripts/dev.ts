// `pnpm dev`: everything a fresh clone needs to run Parley locally.
//
// 1. apps/web/.dev.vars: copied from .dev.vars.example on the first run,
//    with a new BETTER_AUTH_SECRET. An existing file is never touched.
// 2. Local Postgres 18 (`pnpm db:dev`, ADR-0004), unless one already runs on
//    its port. It stops with this script.
// 3. The app (`vp dev` in apps/web), on http://localhost:3000 or $PORT.

import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { connect } from "node:net"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const vars = join(root, "apps/web/.dev.vars")
const DB_PORT = 54320

if (!existsSync(vars)) {
  copyFileSync(`${vars}.example`, vars)
  const secret = randomBytes(32).toString("base64url")
  writeFileSync(
    vars,
    readFileSync(vars, "utf8").replace(
      /^BETTER_AUTH_SECRET=$/m,
      `BETTER_AUTH_SECRET=${secret}`
    )
  )
  console.log("Wrote apps/web/.dev.vars from .dev.vars.example.")
}

/** Something already listens on the port (an earlier `pnpm db:dev`). */
function listening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect(port, "localhost")
    socket.once("connect", () => resolve(!!socket.end()))
    socket.once("error", () => resolve(false))
  })
}

// Each child runs in its own process group (`detached`), and stopping kills
// the group: pnpm and vp don't pass a signal on to the server they started.
const children: ChildProcess[] = []
function stop(code: number) {
  for (const { pid } of children) {
    try {
      if (pid) process.kill(-pid, "SIGTERM")
    } catch {
      // Already gone.
    }
  }
  process.exitCode = code
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => stop(0))

if (!(await listening(DB_PORT))) {
  const db = spawn("pnpm", ["db:dev"], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
    detached: true,
  })
  children.push(db)
  // Ready once it has migrated and says so.
  await new Promise<void>((resolve, reject) => {
    db.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk)
      if (chunk.toString().includes("is ready")) resolve()
    })
    db.once("exit", (code) =>
      reject(new Error(`pnpm db:dev stopped (exit ${code})`))
    )
  })
}

const app = spawn("pnpm", ["vp", "-C", "apps/web", "dev"], {
  cwd: root,
  stdio: "inherit",
  detached: true,
})
children.push(app)
app.once("exit", (code) => stop(code ?? 0))
