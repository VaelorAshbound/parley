import { describe, expect, test } from "vite-plus/test"

import { nightlyReport, reportIdempotencyKey } from "./nightly-report-text.ts"

const runUrl = "https://github.com/o/parley/actions/runs/42"

describe("nightlyReport", () => {
  test("says all green, links the run, and lists each job", () => {
    const report = nightlyReport({
      date: "2026-09-30",
      runUrl,
      jobs: { evals: "success", export: "success" },
      spend: 0.2912,
    })

    expect(report.subject).toBe("Parley nightly 2026-09-30: all green")
    expect(report.text).toContain(runUrl)
    expect(report.text).toContain("- evals: success")
    expect(report.text).toContain("- export: success")
    expect(report.text).toContain("OpenRouter test key: $0.2912")
  })

  test("names the jobs that failed in the subject", () => {
    const report = nightlyReport({
      date: "2026-09-30",
      runUrl,
      jobs: { evals: "failure", export: "success", load: "cancelled" },
    })

    expect(report.subject).toBe(
      "Parley nightly 2026-09-30: failed (evals, load)"
    )
  })

  test("doesn't count a skipped job as failed", () => {
    const report = nightlyReport({
      date: "2026-09-30",
      runUrl,
      jobs: { evals: "success", production: "skipped" },
    })

    expect(report.subject).toBe("Parley nightly 2026-09-30: all green")
    expect(report.text).toContain("- production: skipped")
  })

  test("says when the spend is unknown", () => {
    const report = nightlyReport({
      date: "2026-09-30",
      runUrl,
      jobs: {},
    })

    expect(report.text).toContain("OpenRouter test key: not measured")
  })

  test("adds the eval summary table when there is one", () => {
    const table = "| Right agreement | 100% | ≥ 90% | ✅ |"
    const report = nightlyReport({
      date: "2026-09-30",
      runUrl,
      jobs: {},
      evals: table,
    })

    expect(report.text).toContain(`Evals:\n${table}`)
  })
})

describe("reportIdempotencyKey", () => {
  test("a re-run of the same run gets a new key, so Resend does not answer 409", () => {
    const first = reportIdempotencyKey({ runUrl, attempt: "1", subject: "s" })
    const rerun = reportIdempotencyKey({ runUrl, attempt: "2", subject: "s" })

    expect(first).toBe(`nightly-report/${runUrl}/1`)
    expect(rerun).not.toBe(first)
  })

  test("falls back to attempt 1 and the subject when the run env is missing", () => {
    expect(reportIdempotencyKey({ subject: "s" })).toBe("nightly-report/s/1")
  })
})
