// A Neon branch per git branch for Worker Previews (T33, spec §5 Database).
//
//   node packages/db/scripts/preview-database.ts prepare <git branch> <wrangler.json>
//     Workers Builds' Preview command (scripts/ci-preview.sh), after the
//     build: makes the branch's database fresh, migrates it, and points the
//     built Worker's previews.hyperdrive at it.
//   node packages/db/scripts/preview-database.ts url <git branch>
//     Prints the branch's direct URL, for CI's e2e tests that confirm an
//     email in the database (.github/workflows/e2e.yml).
//
// The Neon branch `preview/<slug>` is made from `production` with an expiry,
// and reset from it on every build, so each run starts from production's
// schema plus this branch's new migrations. Its Hyperdrive config
// `parley-preview--<slug>` has caching off, like the others (spec §5).
// Without NEON_API_KEY, `prepare` leaves the shared `parley-preview`
// binding in place, as before T33.
//
// Neon's own Cloudflare example does the same with the same APIs:
// https://github.com/neondatabase/preview-branches-with-cloudflare
// https://api-docs.neon.tech/reference/createprojectbranch
// https://neon.com/docs/guides/reset-from-parent (POST …/restore)
// https://developers.cloudflare.com/api/resources/hyperdrive/subresources/configs/
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { migrate } from "drizzle-orm/node-postgres/migrator"

import { connect } from "../src/client.ts"
import {
  hyperdriveOrigin,
  orphanedHyperdrives,
  previewNames,
  withPreviewDatabase,
} from "./preview-names.ts"

const neonApi = "https://console.neon.tech/api/v2"
const cloudflareApi = "https://api.cloudflare.com/client/v4"
/** Previews branch from here: production's schema and migrations table. */
const parentBranch = "production"
/** A branch nobody builds for two weeks deletes itself. */
const expiresInMs = 14 * 24 * 60 * 60 * 1000

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

type NeonBranch = { id: string; name: string; parent_id?: string }
type Operation = { id: string; status: string }

async function neon<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(
    `${neonApi}/projects/${required("NEON_PROJECT_ID")}${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${required("NEON_API_KEY")}`,
        accept: "application/json",
        "content-type": "application/json",
      },
    }
  )
  // The body can hold connection details: only the status is logged.
  if (!response.ok)
    throw new Error(`Neon ${init.method ?? "GET"} ${path}: ${response.status}`)
  return (await response.json()) as T
}

async function cloudflare<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(
    `${cloudflareApi}/accounts/${required("CLOUDFLARE_ACCOUNT_ID")}${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${required("CLOUDFLARE_API_TOKEN")}`,
        "content-type": "application/json",
      },
    }
  )
  const body = (await response.json()) as {
    result: T
    errors?: { code: number; message: string }[]
  }
  if (!response.ok)
    throw new Error(
      `Cloudflare ${init.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(body.errors ?? [])}` +
        (response.status === 403
          ? " (the build's API token needs Hyperdrive: Edit)"
          : "")
    )
  return body.result
}

async function branches() {
  return (await neon<{ branches: NeonBranch[] }>("/branches")).branches
}

/** Waits until Neon has finished the branch's create or reset. */
async function settled(operations: Operation[]) {
  for (const { id } of operations) {
    for (let tries = 0; ; tries++) {
      const { operation } = await neon<{ operation: Operation }>(
        `/operations/${id}`
      )
      if (operation.status === "finished" || operation.status === "skipped")
        break
      if (["failed", "error", "cancelled"].includes(operation.status))
        throw new Error(`Neon operation ${id} ${operation.status}`)
      if (tries === 120) throw new Error(`Neon operation ${id} timed out`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

/** The branch's direct (unpooled) URL: migrations and Hyperdrive need it. */
async function directUrl(branchId: string) {
  const { databases } = await neon<{
    databases: { name: string; owner_name: string }[]
  }>(`/branches/${branchId}/databases`)
  const database = databases[0]
  if (!database) throw new Error("The Neon branch has no database")
  const query = new URLSearchParams({
    branch_id: branchId,
    database_name: database.name,
    role_name: database.owner_name,
    pooled: "false",
  })
  return (await neon<{ uri: string }>(`/connection_uri?${query.toString()}`))
    .uri
}

/** A fresh copy of production for the branch, made or reset. */
async function freshBranch(name: string) {
  const all = await branches()
  const parent = all.find((each) => each.name === parentBranch)
  if (!parent) throw new Error(`No Neon branch "${parentBranch}"`)
  const existing = all.find((each) => each.name === name)
  if (existing) {
    // Reset from the parent: production's data and schema again, and a new
    // expiry counted from now. The URL stays the same.
    console.log(`Resetting the Neon branch ${name} from ${parentBranch}`)
    const { operations } = await neon<{ operations: Operation[] }>(
      `/branches/${existing.id}/restore`,
      {
        method: "POST",
        body: JSON.stringify({ source_branch_id: parent.id }),
      }
    )
    await settled(operations)
    return existing.id
  }
  console.log(`Creating the Neon branch ${name} from ${parentBranch}`)
  const { branch, operations } = await neon<{
    branch: NeonBranch
    operations: Operation[]
  }>("/branches", {
    method: "POST",
    body: JSON.stringify({
      branch: {
        name,
        parent_id: parent.id,
        expires_at: new Date(Date.now() + expiresInMs).toISOString(),
      },
      endpoints: [{ type: "read_write" }],
    }),
  })
  await settled(operations)
  return branch.id
}

type HyperdriveConfig = { id: string; name: string }

/** Creates or updates the branch's Hyperdrive config; gives its id. */
async function upsertHyperdrive(name: string, url: string) {
  const configs = await cloudflare<HyperdriveConfig[]>("/hyperdrive/configs")
  const all = await branches()
  for (const orphan of orphanedHyperdrives(
    configs,
    all.map((each) => each.name)
  )) {
    console.log(`Removing ${orphan.name}: its Neon branch is gone`)
    await cloudflare(`/hyperdrive/configs/${orphan.id}`, { method: "DELETE" })
  }
  const body = JSON.stringify({
    name,
    origin: hyperdriveOrigin(url),
    // A cached SELECT would show a stale draft (spec §5 Database).
    caching: { disabled: true },
  })
  const existing = configs.find((each) => each.name === name)
  if (existing) {
    await cloudflare(`/hyperdrive/configs/${existing.id}`, {
      method: "PUT",
      body,
    })
    return existing.id
  }
  console.log(`Creating the Hyperdrive config ${name}`)
  return (
    await cloudflare<HyperdriveConfig>("/hyperdrive/configs", {
      method: "POST",
      body,
    })
  ).id
}

async function prepare(gitBranch: string, configPath: string) {
  if (!process.env.NEON_API_KEY) {
    console.warn(
      "NEON_API_KEY is not set: this Preview uses the shared preview database."
    )
    return
  }
  const names = previewNames(gitBranch)
  const url = await directUrl(await freshBranch(names.neonBranch))

  const db = await connect(url)
  try {
    await migrate(db, {
      migrationsFolder: join(import.meta.dirname, "../migrations"),
    })
  } finally {
    await db.$client.end()
  }
  console.log(`Migrated ${names.neonBranch}`)

  const id = await upsertHyperdrive(names.hyperdrive, url)
  const config = JSON.parse(readFileSync(configPath, "utf8"))
  writeFileSync(configPath, JSON.stringify(withPreviewDatabase(config, id)))
  console.log(`The Preview's HYPERDRIVE is ${names.hyperdrive} (${id})`)
}

async function printUrl(gitBranch: string) {
  const { neonBranch } = previewNames(gitBranch)
  const branch = (await branches()).find((each) => each.name === neonBranch)
  if (!branch) throw new Error(`No Neon branch ${neonBranch}`)
  process.stdout.write(await directUrl(branch.id))
}

const [command, gitBranch = "", configPath] = process.argv.slice(2)
if (command === "prepare" && configPath) await prepare(gitBranch, configPath)
else if (command === "url") await printUrl(gitBranch)
else {
  console.error(
    "Usage: preview-database.ts prepare <git branch> <wrangler.json> | url <git branch>"
  )
  process.exitCode = 2
}
