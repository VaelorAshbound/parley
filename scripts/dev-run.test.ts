// runDev with real child processes: small Node scripts stand in for
// `pnpm db:dev` and the app, and write their pid so the test can tell
// whether they are still running.

import { spawn } from "node:child_process"
import { once } from "node:events"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { afterAll, afterEach, describe, expect, test } from "vite-plus/test"

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

/** A process's state letter on Linux ("Z" for a zombie), or undefined. */
function stateOf(pid: number) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
    // "pid (name) state …": the name can hold spaces and brackets.
    return stat.slice(stat.lastIndexOf(")") + 2)[0]
  } catch {
    return undefined
  }
}

/**
 * Whether the process has not exited yet. `kill(pid, 0)` also reaches a
 * zombie, so on Linux its state decides.
 */
function alive(pid: number) {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  if (!existsSync("/proc/self")) return true
  const state = stateOf(pid)
  return state !== undefined && state !== "Z"
}

function running(pidFile: string) {
  return existsSync(pidFile) && alive(Number(readFileSync(pidFile, "utf8")))
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

afterAll(() => rmSync(dir, { recursive: true, force: true }))

// The runDev tests wait for a stopped process to be gone. One whose parent
// has exited goes to the first process on the machine, which may never
// collect it (in a container whose first process is Node, say): it then
// stays a zombie, which still answers `kill(pid, 0)`, though it has exited.
describe("alive", () => {
  test("is true for a running process", () => {
    expect(alive(process.pid)).toBe(true)
  })

  test.runIf(process.platform === "linux")(
    "is false for a process that has exited but was never collected",
    async () => {
      // sh starts a child, then becomes `sleep`, which never collects it.
      const sh = spawn("sh", ["-c", "true & echo $!; exec sleep 5"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
      try {
        const [chunk] = (await once(sh.stdout, "data")) as [Buffer]
        const pid = Number(chunk.toString().trim())
        await until(() => stateOf(pid) === "Z")
        expect(alive(pid)).toBe(false)
      } finally {
        sh.kill("SIGKILL")
      }
    }
  )
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
