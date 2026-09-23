#!/usr/bin/env bash
# Workers Builds "Preview command" for non-production branches: create the
# Worker Preview, then run the Playwright suite against its URL.
# https://developers.cloudflare.com/workers/previews/examples/
set -euo pipefail
cd "$(git rev-parse --show-toplevel)/apps/web"

output="$(pnpm exec wrangler preview --json)"
printf '%s\n' "$output"
# The build image has no jq; Node reads the same fields the docs use.
preview_url="$(printf '%s' "$output" | node -e '
  const out = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
  const url = out.preview_urls?.[0] ?? out.preview?.urls?.[0]
  if (!url) throw new Error("wrangler preview returned no URL")
  console.log(url)
')"
echo "Preview URL: $preview_url"

pnpm exec playwright install --with-deps chromium firefox webkit
PREVIEW_URL="$preview_url" pnpm exec playwright test
