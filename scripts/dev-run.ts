// The parts of `pnpm dev` (scripts/dev.ts) that tests can run on their own.

import { spawn, type ChildProcess, type StdioOptions } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

/**
 * Copies .dev.vars.example to `vars` with a new BETTER_AUTH_SECRET, unless
 * `vars` exists: an existing file is never touched. Throws when the secret
 * would end up empty, since sessions can't be signed without one.
 */
export function setUpDevVars(vars: string): "created" | "kept" {
  if (existsSync(vars)) {
    if (!hasSecret(readFileSync(vars, "utf8")))
      throw new Error(
        `BETTER_AUTH_SECRET is empty in ${vars}. Set it to a random value ` +
          "(openssl rand -base64 32), or delete the file and run `pnpm dev` " +
          "again to get a new one."
      )
    return "kept"
  }
  const example = `${vars}.example`
  const secret = randomBytes(32).toString("base64url")
  const filled = readFileSync(example, "utf8").replace(
    /^BETTER_AUTH_SECRET=$/m,
    `BETTER_AUTH_SECRET=${secret}`
  )
  // Checked before writing, so a bad example leaves no half-made file.
  if (!hasSecret(filled))
    throw new Error(
      `BETTER_AUTH_SECRET is empty: ${example} has no "BETTER_AUTH_SECRET=" ` +
        "line for `pnpm dev` to fill."
    )
  writeFileSync(vars, filled)
  return "created"
}

// Read as wrangler reads .dev.vars (dotenv, which node:util parseEnv
// follows): quotes and comments are not part of the value, and the last
// line for a key wins. A look at the raw text would let `=""` through.
function hasSecret(dotenv: string) {
  return !!parseEnv(dotenv).BETTER_AUTH_SECRET?.trim()
}

/**
 * Turns chunks of output into whole lines: a chunk can end mid-line, so a
 * line is only passed on once its newline has arrived.
 */
export function lines(onLine: (line: string) => void) {
  let partial = ""
  return (chunk: string) => {
    const parts = (partial + chunk).split("\n")
    partial = parts.pop() ?? ""
    for (const line of parts) onLine(line.replace(/\r$/, ""))
  }
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
  /** Where this script says what happened. */
  log?: (message: string) => void
}

/** A started command, and its exit code once it has stopped. */
interface Started {
  child: ChildProcess
  exited: Promise<number>
  stopped: boolean
}

function start(
  { command, args, cwd }: Command,
  stdio: StdioOptions,
  log: (message: string) => void
): Started {
  // Each child runs in its own process group (`detached`), and stopping
  // kills the group: pnpm and vp don't pass a signal on to the server they
  // started.
  const child = spawn(command, args, { cwd, stdio, detached: true })
  const started: Started = { child, exited: Promise.resolve(0), stopped: false }
  started.exited = new Promise<number>((resolve) => {
    child.once("exit", (code) => resolve(code ?? 1))
    child.once("error", (error) => {
      log(`Could not start ${command}: ${error.message}`)
      resolve(1)
    })
  }).finally(() => (started.stopped = true))
  return started
}

/** Stops every command still running, and waits until each has. */
async function stopAll(running: Started[]) {
  for (const { child, stopped } of running) {
    try {
      if (child.pid && !stopped) process.kill(-child.pid, "SIGTERM")
    } catch {
      // Already gone.
    }
  }
  await Promise.all(running.map(({ exited }) => exited))
}

function aborted(signal: AbortSignal) {
  return new Promise<"ctrl-c">((resolve) => {
    if (signal.aborted) resolve("ctrl-c")
    else
      signal.addEventListener("abort", () => resolve("ctrl-c"), { once: true })
  })
}

/**
 * Starts the database, waits until it says "is ready", then starts the app.
 * Whichever stops first, the other is stopped too: no app without its
 * database. Resolves with the exit code once both have stopped (0 after
 * Ctrl+C), and never rejects.
 */
export async function runDev({
  db,
  app,
  signal,
  out = process.stdout,
  log = console.error,
}: DevOptions): Promise<number> {
  const running: Started[] = []
  const ctrlC = aborted(signal)

  let database: Started | undefined
  if (db) {
    database = start(db, ["ignore", "pipe", "inherit"], log)
    running.push(database)
    const stdout = database.child.stdout
    // Ready once it has migrated and says so, on a line of its own output.
    const ready = new Promise<"ready">((resolve) => {
      stdout?.setEncoding("utf8")
      stdout?.on("data", (chunk: string) => out.write(chunk))
      stdout?.on(
        "data",
        lines((line) => {
          if (line.includes("is ready")) resolve("ready")
        })
      )
    })
    const first = await Promise.race([ready, ctrlC, database.exited])
    if (first === "ctrl-c") {
      await stopAll(running)
      return 0
    }
    if (typeof first === "number") {
      log(`pnpm db:dev stopped (exit ${first}) before the database was ready.`)
      return first || 1
    }
  }

  const application = start(app, "inherit", log)
  running.push(application)
  const first = await Promise.race([
    ctrlC,
    application.exited.then((code) => ({ app: code })),
    ...(database ? [database.exited.then((code) => ({ db: code }))] : []),
  ])
  await stopAll(running)
  if (first === "ctrl-c") return 0
  if ("db" in first) {
    log(`pnpm db:dev stopped (exit ${first.db}), so the app was stopped too.`)
    return first.db || 1
  }
  return first.app
}
