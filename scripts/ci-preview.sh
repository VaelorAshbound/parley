#!/usr/bin/env bash
# Workers Builds "Preview command" for non-production branches: give the
# branch its own fresh, migrated Neon database (T33), then create the Worker
# Preview and print its URL. Browser tests run in GitHub Actions
# (.github/workflows/e2e.yml), because this image can't start browsers.
# https://developers.cloudflare.com/workers/previews/examples/
# The database needs the build variables NEON_API_KEY and NEON_PROJECT_ID,
# and Hyperdrive: Edit on the build's API token. Without NEON_API_KEY the
# Preview keeps the shared preview database, as before T33.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

branch="${WORKERS_CI_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
echo "==> Preparing the database of $branch"
# Patches the built Worker's config (the Vite plugin's output, which wrangler
# reads through .wrangler/deploy/config.json).
node --no-warnings ../../packages/db/scripts/preview-database.ts \
  prepare "$branch" dist/server/wrangler.json

echo "==> Creating the Worker Preview"
# The commit lets the e2e job wait for this exact version (/api/version).
# --name is wrangler's default (the git branch), made explicit so the
# Preview and its database always share the name.
if ! output="$(pnpm exec wrangler preview --json --name "$branch" --var "COMMIT_SHA:${WORKERS_CI_COMMIT_SHA:-}")"; then
  printf '%s\n' "$output"
  echo "wrangler preview failed" >&2
  exit 1
fi
printf '%s\n' "$output"

# The build image has no jq; Node reads the same fields the docs use.
# Wrangler prints a config banner before the JSON, so parse from the first "{".
preview_url="$(printf '%s' "$output" | node -e '
  const text = require("node:fs").readFileSync(0, "utf8")
  const out = JSON.parse(text.slice(text.search(/^\{/m)))
  const url =
    out.preview_urls?.[0] ?? out.preview?.urls?.[0] ?? out.deployment?.urls?.[0]
  if (!url) throw new Error("wrangler preview returned no URL")
  console.log(url)
')"
echo "==> Preview URL: $preview_url"
