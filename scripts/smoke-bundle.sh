#!/usr/bin/env bash
# Boots the built Worker (dist/) in workerd and asks /api/health. A bundle that
# fails at startup (T14: a require() left in by the bundler) then fails the
# build here, instead of at upload. Needs `pnpm build` first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

port=4173
log="$(mktemp)"
if curl -fsS "http://localhost:$port" >/dev/null 2>&1; then
  echo "Port $port is already in use; stop that server first." >&2
  exit 1
fi
# Its own process group, so the workerd children stop with it.
setsid pnpm exec vp preview --port "$port" --strictPort >"$log" 2>&1 &
server=$!
trap 'kill -- "-$server" 2>/dev/null || true; rm -f "$log"' EXIT

for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$port/api/health" >/dev/null 2>&1; then
    echo "The built Worker starts and answers /api/health."
    exit 0
  fi
  if ! kill -0 "$server" 2>/dev/null; then break; fi
  sleep 1
done
echo "The built Worker did not start:" >&2
cat "$log" >&2
exit 1
