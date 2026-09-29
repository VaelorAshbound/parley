// The nightly run's last step (.github/workflows/nightly.yml, T33): writes
// the report to the run's summary page and emails its link to the owner.
//
//   node scripts/nightly-report.ts usage   → prints the OpenRouter test
//                                             key's spend so far
//   node scripts/nightly-report.ts send    → summary + email
//
// `send` reads NEEDS (the workflow's `toJSON(needs)`), RUN_URL,
// GITHUB_RUN_ATTEMPT (set by Actions),
// USAGE_BEFORE, OPENROUTER_API_KEY_TEST, EVALS_REPORT (evals/report.md, if
// the evals ran), RESEND_API_KEY and REPORT_EMAIL. Without the last two it
// only writes the summary. One email a night, from the verified domain.
// https://resend.com/docs/api-reference/emails/send-email
import { appendFileSync, existsSync, readFileSync } from "node:fs"

import { nightlyReport, reportIdempotencyKey } from "./nightly-report-text.ts"

/** The test key's total spend in dollars, or undefined without it. */
async function usage() {
  const key = process.env.OPENROUTER_API_KEY_TEST
  if (!key) return undefined
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { authorization: `Bearer ${key}` },
  })
  if (!response.ok) return undefined
  const { data } = (await response.json()) as { data: { usage: number } }
  return data.usage
}

/** The first table of evals/report.md: the scores against their bars. */
function evalsTable(path: string | undefined) {
  if (!path || !existsSync(path)) return undefined
  const lines = readFileSync(path, "utf8").split("\n")
  const start = lines.findIndex((line) => line.startsWith("|"))
  if (start === -1) return undefined
  const end = lines.findIndex((line, i) => i > start && !line.startsWith("|"))
  return lines.slice(start, end === -1 ? undefined : end).join("\n")
}

async function send() {
  const needs = JSON.parse(process.env.NEEDS ?? "{}") as Record<
    string,
    { result: string }
  >
  const before = Number.parseFloat(process.env.USAGE_BEFORE ?? "")
  const after = await usage()
  const report = nightlyReport({
    date: new Date().toISOString().slice(0, 10),
    runUrl: process.env.RUN_URL ?? "",
    jobs: Object.fromEntries(
      Object.entries(needs).map(([name, { result }]) => [name, result])
    ),
    spend:
      after === undefined || Number.isNaN(before) ? undefined : after - before,
    evals: evalsTable(process.env.EVALS_REPORT),
  })
  console.log(report.text)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary)
    appendFileSync(summary, `## ${report.subject}\n\n${report.text}\n`)

  const key = process.env.RESEND_API_KEY
  const to = process.env.REPORT_EMAIL
  if (!key || !to) {
    console.log("No RESEND_API_KEY or REPORT_EMAIL: no email sent.")
    return
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      // A retry of the same attempt sends nothing twice; a re-run sends again.
      "idempotency-key": reportIdempotencyKey({
        runUrl: process.env.RUN_URL,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
        subject: report.subject,
      }),
    },
    body: JSON.stringify({
      from: "Parley CI <ci@mail.runtimedrift.dev>",
      to,
      subject: report.subject,
      text: report.text,
    }),
  })
  // Resend's error names the problem; it never holds the key.
  if (!response.ok)
    throw new Error(`Resend: ${response.status} ${await response.text()}`)
  console.log("Report emailed.")
}

const command = process.argv[2]
if (command === "usage") console.log((await usage()) ?? "")
else if (command === "send") await send()
else {
  console.error("Usage: nightly-report.ts usage | send")
  process.exitCode = 2
}
