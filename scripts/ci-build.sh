#!/usr/bin/env bash
# Workers Builds "Build command". Every quality gate runs before the build,
# so a failing check stops both production deploys and Previews.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# `prepare` builds it on install too; this makes the build not depend on that.
pnpm documents:build
# Production (main) runs every gate first. Previews only build: GitHub
# Actions and the local gate test each push, and the gate here made every
# Preview wait ~4 minutes (owner, 2026-09-29).
if [ "${WORKERS_CI_BRANCH:-main}" = "main" ]; then
  pnpm check
  # Schema changes must ship with a migration.
  pnpm db:check
  # The Node and workerd tests, with the coverage gates (spec §6).
  pnpm test:coverage
fi
pnpm build
bash scripts/smoke-bundle.sh
