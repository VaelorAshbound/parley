// `pnpm test:perf` (spec §3): the performance budgets (spec §8) on a Preview.
//
//   PREVIEW_URL=https://<branch>-parley.<account>.workers.dev pnpm test:perf
//
// 1. Lighthouse CI (lighthouserc.json) on the public pages, then on a
//    guest's draft page (the app itself), and asserts the budgets:
//    LCP, CLS, every category at 95 or more, and the JS of each route.
// 2. The time to the first AI token with the scripted AI (load/first-token.ts).
// Reports land in .lighthouseci/. Exits non-zero when a budget is missed.
import { spawnSync } from "node:child_process"
import { rmSync } from "node:fs"

import { chromium } from "playwright"

import { newDraft, newGuest, version } from "./guest.ts"
import { loadTestTarget } from "./measure.ts"

const base = loadTestTarget(process.env.PREVIEW_URL)
if (!(await version(base)).scriptedAi)
  throw new Error(`${base} doesn't run the scripted AI: not a Preview.`)

/** Pages anyone can open, without a session. */
const PUBLIC_PAGES = ["/", "/pricing", "/sign-in"]

function run(command: string, args: string[]) {
  const { status } = spawnSync(command, args, { stdio: "inherit" })
  return status ?? 1
}

const lhci = (args: string[]) => run("pnpm", ["exec", "lhci", ...args])

// Playwright's Chromium: already installed for the e2e tests, locally and
// in CI's Playwright image.
const collect = (args: string[]) =>
  lhci([
    "collect",
    `--chromePath=${chromium.executablePath()}`,
    // Cloudflare sends `X-Robots-Tag: noindex` on every workers.dev Preview
    // URL, so search engines skip Previews; Lighthouse's is-crawlable audit
    // would fail there by design. Production (custom domain) keeps it.
    // https://developers.cloudflare.com/workers/previews/custom-domains/#protect-preview-content
    ...(new URL(base).hostname.endsWith(".workers.dev")
      ? ["--settings.skipAudits=is-crawlable"]
      : []),
    ...args,
  ])

rmSync(".lighthouseci", { recursive: true, force: true })
// Every step runs, so one miss doesn't hide another.
const statuses = [collect(PUBLIC_PAGES.map((page) => `--url=${base}${page}`))]

// The draft page, as a new guest first sees it (the app itself): Lighthouse
// sends the guest's session cookie with every request.
const guest = await newGuest(base)
const draft = await newDraft(guest)
statuses.push(
  collect([
    "--additive",
    `--url=${base}/d/${draft}`,
    `--settings.extraHeaders=${JSON.stringify({ cookie: guest.cookie })}`,
  ])
)

// Reports first, so a miss can be looked at.
statuses.push(lhci(["upload"]), lhci(["assert"]))
statuses.push(run("node", ["load/first-token.ts"]))

if (statuses.some((status) => status !== 0)) {
  console.error("A performance budget was missed; see .lighthouseci/reports.")
  process.exitCode = 1
}
