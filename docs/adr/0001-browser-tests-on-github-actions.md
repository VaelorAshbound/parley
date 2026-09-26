# ADR-0001: Run browser tests on GitHub Actions, keep everything else on Workers Builds

## Status

Accepted (owner, 2026-09-23)

## Context

The plan runs all CI in Cloudflare Workers Builds: checks, tests, a Worker Preview per branch, and Playwright in Chromium, Firefox and WebKit against that Preview. The T3 spike (`work/PAR-1/spikes.md`) found:

- Everything except browsers works in Workers Builds: install, `vp check`, Vitest, the workerd tests, the build and `wrangler preview`. It takes about 30 s.
- Browsers can't start. The build image has no root (`playwright install --with-deps` fails at `su`) and no GUI libraries. Chromium and Firefox lack 9 of them (`libatk`, `libgtk-3`, …), and WebKit lacks about 45.

The owner also asked to keep GitHub Actions use low. The free tier is 2,000 minutes a month for private repos, and other projects share it.

## Decision

Workers Builds stays the CI of record: every gate, production deploys, and a Worker Preview per branch. **Only the Playwright browser tests run in GitHub Actions** (`.github/workflows/e2e.yml`):

- On a pull request, the job installs Playwright while Workers Builds builds the Preview. It then waits for the `Workers Builds: parley` check on the same commit and tests that Preview's URL.
- PRs run Chromium only. The nightly and manual runs cover all three browsers. The nightly job stays off until `NIGHTLY_URL` is set (production, T38), so it costs nothing until then.
- Failure traces are GitHub artifacts, kept 7 days. That replaces the planned R2 upload, which Workers Builds needed only because it has no artifact store.
- No Cloudflare secret is stored in GitHub. The job reads the check through `GITHUB_TOKEN` (`checks: read`) and only calls the public Preview URL.

## Alternatives considered

### Unpack the libraries into the build without root

- Pros: everything stays in Workers Builds.
- Cons: about 45 hand-picked libraries for WebKit, which break silently whenever the image changes.
- Rejected: fragile, hand-rolled work where a supported tool exists.

### Chromium only, driven through Browser Run

- Pros: everything stays on Cloudflare.
- Cons: it never tests Firefox or WebKit (Safari). The spec asks for all three.
- Rejected: loses coverage the spec asks for.

### Move all CI to GitHub Actions

- Pros: one CI system.
- Cons: every check would cost Actions minutes, and we'd lose Workers Builds' native Previews and deploys.
- Rejected: costs more and does worse on the parts that already work.

## Consequences

- There are two CI systems, but each has one clear job. The `E2E` check and the `Workers Builds: parley` check both show on every PR.
- PRs test only Chromium. Firefox and WebKit bugs show up in the nightly run, not on the PR. That's a deliberate cost trade-off; we can widen it per PR later if the minute budget allows.
- A PR push costs about 2–3 Actions minutes. Docs-only changes and superseded pushes cost none.
- The workflow only triggers on `pull_request` and `schedule` events, so a branch needs an open PR to get browser tests.
