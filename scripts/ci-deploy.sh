#!/usr/bin/env bash
# Workers Builds "Deploy command" for production (main). It stamps the
# commit, as ci-preview.sh does for Previews, so the smoke test after the
# deploy (.github/workflows/smoke.yml) can wait until the live site serves
# exactly this commit (/api/version).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

pnpm exec wrangler deploy --var "COMMIT_SHA:${WORKERS_CI_COMMIT_SHA:-}"
