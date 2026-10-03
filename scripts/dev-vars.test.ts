import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vite-plus/test"

import { setUpDevVars } from "./dev-run.ts"

const example = join(import.meta.dirname, "../apps/web/.dev.vars.example")

/** A temp apps/web with the real .dev.vars.example in it. */
function appDir() {
  const dir = mkdtempSync(join(tmpdir(), "parley-dev-vars-"))
  writeFileSync(join(dir, ".dev.vars.example"), readFileSync(example))
  return join(dir, ".dev.vars")
}

describe("setUpDevVars", () => {
  test("a fresh clone gets .dev.vars with a new secret", () => {
    const vars = appDir()

    expect(setUpDevVars(vars)).toBe("created")

    const written = readFileSync(vars, "utf8")
    // 32 random bytes, base64url.
    expect(written).toMatch(/^BETTER_AUTH_SECRET=[\w-]{43}$/m)
    expect(written).toContain("SCRIPTED_AI=on")
  })

  test("each fresh clone gets its own secret", () => {
    const first = appDir()
    const second = appDir()

    setUpDevVars(first)
    setUpDevVars(second)

    const secret = (vars: string) =>
      /^BETTER_AUTH_SECRET=(.+)$/m.exec(readFileSync(vars, "utf8"))?.[1]
    expect(secret(first)).not.toBe(secret(second))
  })

  test("an existing .dev.vars is left exactly as it is", () => {
    const vars = appDir()
    const mine = "BETTER_AUTH_SECRET=mine\nOPENROUTER_API_KEY=sk-or-mine\n"
    writeFileSync(vars, mine)

    expect(setUpDevVars(vars)).toBe("kept")

    expect(readFileSync(vars, "utf8")).toBe(mine)
  })

  test("fails loudly when an existing .dev.vars has an empty secret", () => {
    const vars = appDir()
    writeFileSync(vars, "BETTER_AUTH_SECRET=\nSCRIPTED_AI=on\n")

    expect(() => setUpDevVars(vars)).toThrow(
      /BETTER_AUTH_SECRET is empty in .*\.dev\.vars/
    )
    // Still untouched: the person fixes it, not this script.
    expect(readFileSync(vars, "utf8")).toBe(
      "BETTER_AUTH_SECRET=\nSCRIPTED_AI=on\n"
    )
  })

  // Empty to dotenv, which wrangler reads .dev.vars with, though not to a
  // look at the raw text: quotes, a comment, only spaces, or a later empty
  // line (the last one counts).
  test.each([
    'BETTER_AUTH_SECRET=""\n',
    "BETTER_AUTH_SECRET=''\n",
    "BETTER_AUTH_SECRET=#comment\n",
    'BETTER_AUTH_SECRET="   "\n',
    "BETTER_AUTH_SECRET=mine\nSCRIPTED_AI=on\nBETTER_AUTH_SECRET=\n",
  ])("fails loudly when an existing secret is empty to dotenv: %j", (text) => {
    const vars = appDir()
    writeFileSync(vars, text)

    expect(() => setUpDevVars(vars)).toThrow(/BETTER_AUTH_SECRET is empty/)
    expect(readFileSync(vars, "utf8")).toBe(text)
  })

  test("a quoted secret with a trailing comment counts", () => {
    const vars = appDir()
    writeFileSync(vars, 'BETTER_AUTH_SECRET="mine" # local only\n')

    expect(setUpDevVars(vars)).toBe("kept")
  })

  test("fails loudly when the example has no BETTER_AUTH_SECRET= line to fill", () => {
    const vars = appDir()
    writeFileSync(`${vars}.example`, "SCRIPTED_AI=on\n")

    expect(() => setUpDevVars(vars)).toThrow(/BETTER_AUTH_SECRET is empty/)
    // No half-made file for the next run to keep.
    expect(existsSync(vars)).toBe(false)
  })
})
