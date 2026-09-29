// The pure half of preview-database.ts (T33): how a git branch's Preview,
// Neon branch and Hyperdrive config are named, and the config change that
// points a Preview at its own database.

/** Per-branch Hyperdrive configs start with this; `parley-preview` doesn't. */
const hyperdrivePrefix = "parley-preview--"
const neonPrefix = "preview/"

/**
 * The names for one git branch. The slug is the one Workers Builds puts in
 * the Preview's URL, the same one .github/workflows/e2e.yml builds (every
 * character outside a-z and 0-9 becomes a dash).
 */
export function previewNames(gitBranch: string) {
  if (!gitBranch) throw new Error("No git branch name for the Preview")
  const slug = gitBranch.toLowerCase().replace(/[^a-z0-9]/g, "-")
  return {
    slug,
    neonBranch: `${neonPrefix}${slug}`,
    hyperdrive: `${hyperdrivePrefix}${slug}`,
  }
}

type Binding = { binding: string; id: string }

/**
 * The built Worker's config (dist/server/wrangler.json) with the Preview's
 * HYPERDRIVE pointed at `hyperdriveId`. Production's binding is untouched.
 */
export function withPreviewDatabase<
  Config extends { previews: { hyperdrive: Binding[] } },
>(config: Config, hyperdriveId: string): Config {
  const bindings = config.previews.hyperdrive
  if (!bindings.some((each) => each.binding === "HYPERDRIVE"))
    throw new Error("No HYPERDRIVE binding in previews.hyperdrive to replace")
  return {
    ...config,
    previews: {
      ...config.previews,
      hyperdrive: bindings.map((each) =>
        each.binding === "HYPERDRIVE" ? { ...each, id: hyperdriveId } : each
      ),
    },
  }
}

/**
 * Per-branch Hyperdrive configs whose Neon branch has expired or was
 * deleted. Neon deletes a branch at its expiry time, Hyperdrive has none,
 * so each Preview build removes the leftovers (Neon's own Cloudflare
 * example does the same). Other projects' configs share the account: only
 * names with our prefix are ever touched.
 */
export function orphanedHyperdrives<Config extends { name: string }>(
  configs: Config[],
  neonBranches: string[]
) {
  const live = new Set(neonBranches)
  return configs.filter(
    ({ name }) =>
      name.startsWith(hyperdrivePrefix) &&
      !live.has(neonPrefix + name.slice(hyperdrivePrefix.length))
  )
}

/** A Postgres URL as the `origin` Hyperdrive's API takes. */
export function hyperdriveOrigin(url: string) {
  const parsed = new URL(url)
  return {
    scheme: parsed.protocol.replace(/:$/, ""),
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.slice(1)),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  }
}
