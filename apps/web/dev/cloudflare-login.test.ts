import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vite-plus/test"

import {
  readWhoami,
  signedInToCloudflare,
  whoami,
  type Login,
} from "./cloudflare-login.ts"

describe("readWhoami", () => {
  test("exit 0 is a login", () => {
    const login = readWhoami({ status: 0, stdout: '{"loggedIn":true}' })

    expect(login).toEqual({ state: "signed-in" })
  })

  test("loggedIn: false is no login", () => {
    const login = readWhoami({ status: 1, stdout: '{"loggedIn":false}' })

    expect(login).toEqual({ state: "signed-out" })
  })

  test("a timeout is not known either way, and says why", () => {
    const error = Object.assign(new Error("spawnSync node ETIMEDOUT"), {
      code: "ETIMEDOUT",
    })

    const login = readWhoami({ status: null, stdout: "", error })

    expect(login).toEqual({
      state: "unknown",
      reason: "spawnSync node ETIMEDOUT",
    })
  })

  test("a failure without an answer (no network) is not known either way", () => {
    const login = readWhoami({ status: 1, stdout: "" })

    expect(login).toEqual({ state: "unknown", reason: "exit 1" })
  })
})

describe("signedInToCloudflare", () => {
  const never = (): Login => {
    throw new Error("wrangler should not run")
  }

  test("an API token counts without starting wrangler", () => {
    const signedIn = signedInToCloudflare({
      env: { CLOUDFLARE_API_TOKEN: "token" },
      ask: never,
    })

    expect(signedIn).toBe(true)
  })

  test("a login wrangler knows counts, wherever wrangler keeps it", () => {
    // The bug (PAR-50): only $XDG_CONFIG_HOME/.wrangler was looked at, so a
    // login in ~/.wrangler or ~/Library/Preferences/.wrangler (macOS) was
    // missed. Wrangler itself is now the one asked.
    const warnings: string[] = []

    const signedIn = signedInToCloudflare({
      env: {},
      ask: () => ({ state: "signed-in" }),
      warn: (message) => warnings.push(message),
    })

    expect(signedIn).toBe(true)
    expect(warnings).toEqual([])
  })

  test("no login turns PDF export off and says how to log in", () => {
    const warnings: string[] = []

    const signedIn = signedInToCloudflare({
      env: {},
      ask: () => ({ state: "signed-out" }),
      warn: (message) => warnings.push(message),
    })

    expect(signedIn).toBe(false)
    expect(warnings).toEqual([
      "No Cloudflare login: PDF export is off. Run `pnpm exec wrangler login` to turn it on.",
    ])
  })

  test("an unknown login turns PDF export off and says why", () => {
    const warnings: string[] = []

    const signedIn = signedInToCloudflare({
      env: {},
      ask: () => ({ state: "unknown", reason: "spawnSync node ETIMEDOUT" }),
      warn: (message) => warnings.push(message),
    })

    expect(signedIn).toBe(false)
    expect(warnings).toEqual([
      "Could not check the Cloudflare login (wrangler whoami: spawnSync node ETIMEDOUT): PDF export is off.",
    ])
  })
})

describe("whoami, the real wrangler", () => {
  test("an empty home is signed out", { timeout: 20_000 }, () => {
    // No network needed: with no credentials wrangler answers at once.
    const home = mkdtempSync(join(tmpdir(), "parley-home-"))

    const result = whoami({
      env: { PATH: process.env.PATH, HOME: home },
      cwd: home,
    })

    expect(readWhoami(result)).toEqual({ state: "signed-out" })
  })
})
