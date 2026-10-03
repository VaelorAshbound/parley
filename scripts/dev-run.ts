// The parts of `pnpm dev` (scripts/dev.ts) that tests can run on their own.

import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"

/**
 * Copies .dev.vars.example to `vars` with a new BETTER_AUTH_SECRET, unless
 * `vars` exists: an existing file is never touched.
 */
export function setUpDevVars(vars: string): "created" | "kept" {
  if (existsSync(vars)) return "kept"
  copyFileSync(`${vars}.example`, vars)
  const secret = randomBytes(32).toString("base64url")
  writeFileSync(
    vars,
    readFileSync(vars, "utf8").replace(
      /^BETTER_AUTH_SECRET=$/m,
      `BETTER_AUTH_SECRET=${secret}`
    )
  )
  return "created"
}

/** A command to start: what `spawn` takes. */
export interface Command {
  command: string
  args: string[]
  cwd: string
}

export interface DevOptions {
  /** Local Postgres; left out when one already runs. */
  db?: Command | undefined
  app: Command
  /** Ctrl+C: stops everything. */
  signal: AbortSignal
  /** Where the database's output goes. */
  out?: NodeJS.WritableStream
}

/**
 * Starts the database, waits until it says "is ready", then starts the app.
 * Resolves with the exit code once the app stops.
 */
export async function runDev({
  db,
  app,
  signal,
  out = process.stdout,
}: DevOptions): Promise<number> {
  // Each child runs in its own process group (`detached`), and stopping
  // kills the group: pnpm and vp don't pass a signal on to the server they
  // started.
  const children: ChildProcess[] = []
  let exitCode = 0
  let done: (code: number) => void = () => {}
  const finished = new Promise<number>((resolve) => (done = resolve))
  function stop(code: number) {
    for (const { pid } of children) {
      try {
        if (pid) process.kill(-pid, "SIGTERM")
      } catch {
        // Already gone.
      }
    }
    exitCode = code
    done(exitCode)
  }
  signal.addEventListener("abort", () => stop(0), { once: true })

  if (db) {
    const child = spawn(db.command, db.args, {
      cwd: db.cwd,
      stdio: ["ignore", "pipe", "inherit"],
      detached: true,
    })
    children.push(child)
    // Ready once it has migrated and says so.
    await new Promise<void>((resolve, reject) => {
      child.stdout.on("data", (chunk: Buffer) => {
        out.write(chunk)
        if (chunk.toString().includes("is ready")) resolve()
      })
      child.once("exit", (code) =>
        reject(new Error(`pnpm db:dev stopped (exit ${code})`))
      )
    })
  }

  const child = spawn(app.command, app.args, {
    cwd: app.cwd,
    stdio: "inherit",
    detached: true,
  })
  children.push(child)
  child.once("exit", (code) => stop(code ?? 0))
  return finished
}
