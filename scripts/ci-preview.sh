#!/usr/bin/env bash
# Workers Builds "Preview command" for non-production branches: create the
# Worker Preview, then run the Playwright suite against its URL.
# https://developers.cloudflare.com/workers/previews/examples/
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

echo "==> Creating the Worker Preview"
if ! output="$(pnpm exec wrangler preview --json)"; then
  printf '%s\n' "$output"
  echo "wrangler preview failed" >&2
  exit 1
fi
printf '%s\n' "$output"

# The build image has no jq; Node reads the same fields the docs use.
preview_url="$(printf '%s' "$output" | node -e '
  const out = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
  const url = out.preview_urls?.[0] ?? out.preview?.urls?.[0]
  if (!url) throw new Error("wrangler preview returned no URL")
  console.log(url)
')"
echo "==> Preview URL: $preview_url"

echo "==> Installing Playwright browsers"
pnpm exec playwright install --with-deps chromium firefox webkit

echo "==> Running Playwright against the Preview"
PREVIEW_URL="$preview_url" pnpm exec playwright test
