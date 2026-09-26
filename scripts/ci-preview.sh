#!/usr/bin/env bash
# Workers Builds "Preview command" for non-production branches: create the
# Worker Preview and print its URL. Browser tests run in GitHub Actions
# (.github/workflows/e2e.yml), because this image can't start browsers.
# https://developers.cloudflare.com/workers/previews/examples/
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

echo "==> Creating the Worker Preview"
# The commit lets the e2e job wait for this exact version (/api/version).
if ! output="$(pnpm exec wrangler preview --json --var "COMMIT_SHA:${WORKERS_CI_COMMIT_SHA:-}")"; then
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
