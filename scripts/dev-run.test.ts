// runDev with real child processes: small Node scripts stand in for
// `pnpm db:dev` and the app, and write their pid so the test can tell
// whether they are still running.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { afterEach, describe, expect, test } from "vite-plus/test"

import { lines, runDev, type Command } from "./dev-run.ts"

const dir = mkdtempSync(join(tmpdir(), "parley-dev-run-"))
const dbPid = join(dir, "db.pid")
const appPid = join(dir, "app.pid")
const leftPid = join(dir, "left.pid")

/** A Node script that writes its pid to `pidFile`, then runs `code`. */
function node(pidFile: string, code: string): Command {
  return {
    command: process.execPath,
    args: [
      "-e",
      `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); ${code}`,
    ],
    cwd: dir,
  }
}
const forever = "setInterval(() => {}, 1000)"

/**
 * Starts a process in the same group that outlives the one that started it
 * (postgres after db:dev, workerd after vite), and writes its pid.
 */
const leaveOneRunning = `require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(
  `require("fs").writeFileSync(${JSON.stringify(leftPid)}, String(process.pid)); ${forever}`
)}], { stdio: "ignore" });`

function running(pidFile: string) {
  if (!existsSync(pidFile)) return false
  try {
    process.kill(Number(readFileSync(pidFile, "utf8")), 0)
    return true
  } catch {
    return false
  }
}

/** Rejects instead of hanging the test when `promise` never settles. */
function within<T>(promise: Promise<T>, ms = 4000) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`still running after ${ms} ms`)), ms)
    ),
  ])
}

async function until(check: () => boolean, ms = 3000) {
  for (const start = Date.now(); !check();) {
    if (Date.now() - start > ms) throw new Error("timed out waiting")
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

afterEach(async () => {
  // Never leave a stand-in running, even when a test fails.
  for (const pidFile of [dbPid, appPid, leftPid]) {
    if (running(pidFile))
      process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL")
    await until(() => !running(pidFile))
    rmSync(pidFile, { force: true })
  }
})

describe("lines", () => {
  test("passes on whole lines only, across chunks and CRLF endings", () => {
    const seen: string[] = []
    const write = lines((line) => seen.push(line))

    write("one\r\ntw")
    write("o\nthr")

    expect(seen).toEqual(["one", "two"])
  })
})

describe("runDev", () => {
  test("starts the app once the database says it is ready, even split across chunks", async () => {
    // "is re" and "ady" arrive as two chunks of output.
    const db = node(
      dbPid,
      `process.stdout.write("database is re"); setTimeout(() => process.stdout.write("ady\\n"), 100); ${forever}`
    )
    const app = node(appPid, "process.exit(7)")

    const code = await within(
      runDev({
        db,
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(7)
    expect(running(dbPid)).toBe(false)
  })

  test("stops the app when the database stops after it was ready", async () => {
    const db = node(
      dbPid,
      `console.log("database is ready"); setTimeout(() => process.exit(3), 500)`
    )
    const app = node(appPid, forever)

    const code = await within(
      runDev({
        db,
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(3)
    expect(running(appPid)).toBe(false)
  })

  test("Ctrl+C while the database starts ends cleanly, without the app", async () => {
    const db = node(dbPid, forever)
    const app = node(appPid, forever)
    const ctrlC = new AbortController()

    const result = runDev({
      db,
      app,
      signal: ctrlC.signal,
      out: new PassThrough(),
    })
    await until(() => running(dbPid))
    ctrlC.abort()

    await expect(within(result)).resolves.toBe(0)
    expect(running(dbPid)).toBe(false)
    expect(existsSync(appPid)).toBe(false)
  })

  test("Ctrl+C once running stops both", async () => {
    const db = node(dbPid, `console.log("database is ready"); ${forever}`)
    const app = node(appPid, forever)
    const ctrlC = new AbortController()

    const result = runDev({
      db,
      app,
      signal: ctrlC.signal,
      out: new PassThrough(),
    })
    await until(() => running(appPid))
    ctrlC.abort()

    await expect(within(result)).resolves.toBe(0)
    expect(running(dbPid)).toBe(false)
    expect(running(appPid)).toBe(false)
  })

  // A command whose first process has exited can still leave others in its
  // group, holding a port: each group is stopped whether or not its first
  // process is still there.
  test("stops what the app left running when the app exits", async () => {
    const app = node(
      appPid,
      `${leaveOneRunning} setTimeout(() => process.exit(5), 300)`
    )

    const code = await within(
      runDev({
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(5)
    expect(existsSync(leftPid)).toBe(true)
    await until(() => !running(leftPid))
  })

  test("stops what the database left running when it stops after it was ready", async () => {
    const db = node(
      dbPid,
      `${leaveOneRunning} console.log("database is ready"); setTimeout(() => process.exit(3), 300)`
    )
    const app = node(appPid, forever)

    const code = await within(
      runDev({
        db,
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(3)
    expect(running(appPid)).toBe(false)
    expect(existsSync(leftPid)).toBe(true)
    await until(() => !running(leftPid))
  })

  test("stops what the database left running when it stops before it was ready", async () => {
    const db = node(
      dbPid,
      `${leaveOneRunning} setTimeout(() => process.exit(2), 300)`
    )
    const app = node(appPid, forever)

    const code = await within(
      runDev({
        db,
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(2)
    expect(existsSync(appPid)).toBe(false)
    expect(existsSync(leftPid)).toBe(true)
    await until(() => !running(leftPid))
  })

  test("without a database to start, runs the app alone", async () => {
    const app = node(appPid, "process.exit(0)")

    const code = await within(
      runDev({
        app,
        signal: new AbortController().signal,
        out: new PassThrough(),
      })
    )

    expect(code).toBe(0)
  })
})
