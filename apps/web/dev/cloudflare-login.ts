import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

// Browser Run (PDF export) has no local simulator, so dev uses the real one
// (ADR-0010), which needs a Cloudflare login: an API token, or
// `wrangler login`. A fresh clone has neither and runs without remote
// bindings: everything works except the PDF.
//
// Why ask `wrangler whoami` and not look for wrangler's files: wrangler
// keeps a login in ~/.wrangler, in $XDG_CONFIG_HOME/.wrangler, in
// ~/Library/Preferences/.wrangler on macOS, per auth profile, encrypted
// with the key in the OS keyring, or takes it from a .env file. Copying
// those rules here goes stale with the next wrangler release; asking
// wrangler can't, and it also catches a login that has expired. The cost is
// 2 to 5 s each time the dev server starts.

/** Environment variables (worker-configuration.d.ts narrows NodeJS.ProcessEnv). */
type Env = Record<string, string | undefined>

/** Long enough for the API call on a slow network, short enough to notice. */
export const WHOAMI_TIMEOUT_MS = 10_000

export type Login =
  | { state: "signed-in" }
  | { state: "signed-out" }
  | { state: "unknown"; reason: string }

/** What `wrangler whoami --json` says about the login. */
export function readWhoami(
  result: Pick<SpawnSyncReturns<string>, "status" | "stdout" | "error">
): Login {
  if (result.error) return { state: "unknown", reason: result.error.message }
  if (result.status === 0) return { state: "signed-in" }
  if (loggedOut(result.stdout)) return { state: "signed-out" }
  return { state: "unknown", reason: `exit ${result.status}` }
}

function loggedOut(stdout: string) {
  try {
    return (JSON.parse(stdout) as { loggedIn?: unknown }).loggedIn === false
  } catch {
    return false
  }
}

const wranglerBin = join(
  dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin/wrangler.js"
)

/** Runs this app's own wrangler, as the Cloudflare plugin would see it. */
export function whoami({
  env = process.env,
  cwd = join(import.meta.dirname, ".."),
  timeout = WHOAMI_TIMEOUT_MS,
}: { env?: Env; cwd?: string; timeout?: number } = {}) {
  return spawnSync(process.execPath, [wranglerBin, "whoami", "--json"], {
    cwd,
    // No usage report for a check nobody asked for. The cast: the Worker
    // types make each of the app's variables required in NodeJS.ProcessEnv.
    env: { ...env, WRANGLER_SEND_METRICS: "false" } as Env as NodeJS.ProcessEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout,
  })
}

export function signedInToCloudflare({
  env = process.env,
  ask = () => readWhoami(whoami({ env })),
  warn = console.warn,
}: {
  env?: Env
  ask?: () => Login
  warn?: (message: string) => void
} = {}) {
  // CI and anyone with a token: no need to start wrangler.
  if (env.CLOUDFLARE_API_TOKEN) return true
  const login = ask()
  if (login.state === "signed-in") return true
  warn(
    login.state === "signed-out"
      ? "No Cloudflare login: PDF export is off. Run `pnpm exec wrangler login` to turn it on."
      : `Could not check the Cloudflare login (wrangler whoami: ${login.reason}): PDF export is off.`
  )
  return false
}
