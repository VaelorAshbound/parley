// The nightly run's report (T33): a subject that says at a glance whether
// anything broke, the link to the run, each job's result, the OpenRouter
// spend and the eval scores. Pure, so it is tested; nightly-report.ts sends
// it.

export type NightlyReportInput = {
  /** YYYY-MM-DD, UTC. */
  date: string
  runUrl: string
  /** Job name → GitHub's result: success, failure, cancelled or skipped. */
  jobs: Record<string, string>
  /** Dollars spent on the OpenRouter test key during the run. */
  spend?: number | undefined
  /** The summary table from evals/report.md, when the evals ran. */
  evals?: string | undefined
}

export function nightlyReport({
  date,
  runUrl,
  jobs,
  spend,
  evals,
}: NightlyReportInput) {
  const failed = Object.entries(jobs)
    .filter(([, result]) => result !== "success" && result !== "skipped")
    .map(([name]) => name)
  const subject = `Parley nightly ${date}: ${
    failed.length === 0 ? "all green" : `failed (${failed.join(", ")})`
  }`
  const lines = [
    subject,
    "",
    `Run: ${runUrl}`,
    "",
    "Jobs:",
    ...Object.entries(jobs).map(([name, result]) => `- ${name}: ${result}`),
    "",
    `OpenRouter test key: ${spend === undefined ? "not measured" : `$${spend.toFixed(4)}`}`,
  ]
  if (evals) lines.push("", `Evals:\n${evals}`)
  return { subject, text: lines.join("\n") }
}

/**
 * Resend's idempotency key for the report email. The same attempt sent twice
 * sends one email; a re-run of the workflow run is a new attempt, so it gets
 * a new key (the old one would answer 409 invalid_idempotent_request).
 */
export function reportIdempotencyKey({
  runUrl,
  attempt,
  subject,
}: {
  runUrl?: string | undefined
  /** GITHUB_RUN_ATTEMPT: 1 on the first run, +1 on each re-run. */
  attempt?: string | undefined
  subject: string
}) {
  return `nightly-report/${runUrl || subject}/${attempt || "1"}`
}
