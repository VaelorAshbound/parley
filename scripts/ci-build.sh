#!/usr/bin/env bash
# Workers Builds "Build command". Every quality gate runs before the build,
# so a failing check stops both production deploys and Previews.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

pnpm check
pnpm test
pnpm test:workers
pnpm build
