// The server code's coverage gate (spec §6: lines 95%, branches 90%). Its
// tests run in two places: the Node unit tests (V8 coverage, coverage/) and
// the workerd tests (Istanbul, apps/web-worker-tests/coverage/). Neither run
// sees the whole picture, so this adds them up.
//
// Both reports are Istanbul JSON with the same source positions (Vitest's V8
// coverage is remapped on the AST to match Istanbul's). They are merged by
// position, not by index: a statement or branch counts as covered when either
// run covered the one at the same place, and a place only one run knows is
// kept as that run saw it.
//
//   node scripts/coverage-server.ts   (run by `pnpm test:coverage`)

import { readFileSync } from "node:fs"
import { join, relative } from "node:path"

const root = join(import.meta.dirname, "..")
const server = join(root, "apps/web/src/server/")
const thresholds = { lines: 95, branches: 90 }
const reports = [
  join(root, "coverage/coverage-final.json"),
  join(root, "apps/web-worker-tests/coverage/coverage-final.json"),
]

type Position = { line: number; column: number | null }
type Range = { start: Position; end: Position }
type FileCoverage = {
  statementMap: Record<string, Range>
  s: Record<string, number>
  branchMap: Record<string, { type: string; loc: Range; locations: Range[] }>
  b: Record<string, number[]>
}

const at = ({ start, end }: Range) =>
  `${start.line}:${start.column}-${end.line}:${end.column}`

/** Hits per statement and per branch path, keyed by where they are. */
type Hits = { statements: Map<string, number>; branches: Map<string, number> }

function add(hits: Hits, file: FileCoverage) {
  for (const [id, range] of Object.entries(file.statementMap)) {
    const key = at(range)
    hits.statements.set(key, (hits.statements.get(key) ?? 0) + file.s[id]!)
  }
  for (const [id, branch] of Object.entries(file.branchMap))
    branch.locations.forEach((path, index) => {
      const key = `${branch.type}@${at(branch.loc)}#${index}@${at(path)}`
      hits.branches.set(
        key,
        (hits.branches.get(key) ?? 0) + file.b[id]![index]!
      )
    })
}

const files = new Map<string, Hits>()
for (const report of reports) {
  const coverage = JSON.parse(readFileSync(report, "utf8")) as Record<
    string,
    FileCoverage
  >
  for (const [path, file] of Object.entries(coverage)) {
    if (!path.startsWith(server)) continue
    const hits = files.get(path) ?? {
      statements: new Map(),
      branches: new Map(),
    }
    files.set(path, hits)
    add(hits, file)
  }
}

/** Istanbul's lines: a line is covered when a statement starting on it is. */
function lines(statements: Map<string, number>) {
  const byLine = new Map<string, number>()
  for (const [key, count] of statements) {
    const line = key.slice(0, key.indexOf(":"))
    byLine.set(line, Math.max(byLine.get(line) ?? 0, count))
  }
  return byLine
}

const total = { lines: [0, 0], branches: [0, 0] }
const rows: [string, number, number][] = []
for (const [path, hits] of files) {
  const counts = { lines: lines(hits.statements), branches: hits.branches }
  const missed = { lines: 0, branches: 0 }
  for (const kind of ["lines", "branches"] as const)
    for (const count of counts[kind].values()) {
      total[kind][1]!++
      if (count > 0) total[kind][0]!++
      else missed[kind]++
    }
  if (missed.lines + missed.branches > 0)
    rows.push([relative(root, path), missed.lines, missed.branches])
}

const percent = ([covered, all]: number[]) => (100 * covered!) / (all || 1)
let failed = files.size === 0
console.log(`Server coverage (Node + workerd), ${files.size} files:`)
for (const kind of ["lines", "branches"] as const) {
  const value = percent(total[kind])
  const ok = value >= thresholds[kind]
  failed ||= !ok
  console.log(
    `  ${kind}: ${value.toFixed(2)}% (${total[kind][0]}/${total[kind][1]}), needs ${thresholds[kind]}% ${ok ? "ok" : "FAILED"}`
  )
}
if (failed) {
  console.log("Not covered (lines, branches):")
  for (const [path, missedLines, missedBranches] of rows.sort(
    (a, b) => b[1] + b[2] - a[1] - a[2]
  ))
    console.log(`  ${path}: ${missedLines}, ${missedBranches}`)
  process.exitCode = 1
}
