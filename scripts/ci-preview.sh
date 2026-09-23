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

# No root in Workers Builds, so no --with-deps: the browsers must run on the
# image's own libraries. Report what's missing instead of failing blind.
echo "==> Installing Playwright browsers"
pnpm exec playwright install chromium firefox webkit
for browser in chromium firefox webkit; do
  echo "==> Missing libraries for $browser:"
  pnpm exec playwright install-deps --dry-run "$browser" 2>&1 | tail -n 3 || true
done

echo "==> Running Playwright against the Preview"
PREVIEW_URL="$preview_url" pnpm exec playwright test
