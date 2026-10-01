#!/usr/bin/env bash
# Runs the e2e tests with the browsers in Playwright's official image, the
# same one CI runs in (.github/workflows/e2e.yml), so screenshots match the
# baselines and WebKit works on any Linux. The test runner stays on this
# machine and drives the browsers over Playwright's remote connection:
# https://playwright.dev/docs/docker#remote-connection
# Arguments go to `playwright test`. Needs the dev server (or PREVIEW_URL).
# WebKit needs PREVIEW_URL: it won't keep the session's Secure cookie on
# plain http://localhost, which Chromium and Firefox allow.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../apps/web"

engine="$(command -v podman || command -v docker)"
# The server is this project's own playwright-core, mounted in: the exact
# version the tests use, and nothing to download.
core="$(dirname "$(node -p "require.resolve('playwright-core/package.json', { paths: [require.resolve('playwright/package.json', { paths: [require.resolve('@playwright/test/package.json')] })] })")")"
version="$(node -p "require('$core/package.json').version")"
port="${PW_SERVER_PORT:-3100}"
name="parley-playwright-$$"
# Run as this user, so the container can read the mounted package.
if [[ "$(basename "$engine")" == podman ]]; then
  as_me=(--userns=keep-id)
else
  as_me=(--user "$(id -u):$(id -g)")
fi

# Host networking: the browsers reach the dev server on localhost, and with
# the host's resolv.conf they find Turnstile's servers the way this machine
# does (podman's own DNS doesn't answer on a host network).
"$engine" run --detach --rm --init --ipc=host --network=host \
  --name "$name" "${as_me[@]}" -v /etc/resolv.conf:/etc/resolv.conf:ro \
  -v "$core:/opt/playwright-core:ro" \
  "mcr.microsoft.com/playwright:v$version-noble" \
  node /opt/playwright-core/cli.js run-server --port "$port" --host 127.0.0.1 \
  >/dev/null
trap '"$engine" stop --time 2 "$name" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$port/"; then break; fi
  sleep 1
done

PW_TEST_CONNECT_WS_ENDPOINT="ws://127.0.0.1:$port/" PW_VISUAL=1 \
  pnpm exec playwright test "$@"
