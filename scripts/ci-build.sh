#!/usr/bin/env bash
# Workers Builds "Build command". Every quality gate runs before the build,
# so a failing check stops both production deploys and Previews.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm check
# `prepare` builds it on install too; this makes the gate not depend on that.
pnpm documents:build
pnpm test
pnpm test:workers
pnpm build
