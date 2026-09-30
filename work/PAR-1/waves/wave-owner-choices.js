export const meta = {
  name: 'par1-wave-owner-choices',
  description: 'PAR-1 follow-up wave: PAR-40+42 owner choices, PAR-44 reopen card, PAR-45 design polish; build, review, fix in worktrees',
  phases: [
    { title: 'Build', detail: 'one agent per lane in its own worktree, test-first' },
    { title: 'Review', detail: 'fresh five-axis review of each lane branch' },
    { title: 'Fix', detail: 'fix review findings, re-run gates' },
  ],
}

const REPO = '/home/velkyr/Projects/parley'
const SCRATCH = '/tmp/claude-1000/-home-velkyr-Projects-parley/7e9a623f-551e-4f9e-a6ce-a76da6886f65/scratchpad'
const E2E_LOCK = `${SCRATCH}/e2e.lock`
const BASE = 'fe93597'

const LANES = [
  { key: 'choices', port: 3161, items: ['PAR-40', 'PAR-42'], skills: 'agent-skills:frontend-ui-engineering', specs: 'e2e/export.spec.ts e2e/chat.spec.ts',
    focus: `Apply two owner decisions (read the last log entries of each item).
PAR-40: an empty optional field prints "None." in the PDF and DOCX (not blank; the section heading stays). For the DPA group checklists, check the result reads well (no dangling "Label: " followed by nothing). The React preview keeps its placeholder prompt. Keep the T31 export baselines passing; update a baseline only where this change is the intended difference, and say which.
PAR-42: the change marker's value uses a 2-line clamp; the full value is available on hover (title/tooltip) and in the accessible name. Align the row's icon, label and Undo with the first line (items-start), as the earlier review suggested.` },
  { key: 'reopen', port: 3162, items: ['PAR-44'], skills: 'agent-skills:frontend-ui-engineering, emil-design-eng, agent-skills:documentation-and-adrs (for the spec edit)', specs: 'e2e/shell.spec.ts e2e/a11y.spec.ts',
    focus: `Owner decision (see the last log entry of PAR-44): (1) Remove "expand to full width" from work/PAR-1/spec.md §1 (the panel is resizable), with a short dated note why. (2) Build a reopen card in the chat when the document panel is closed (desktop): a small card showing the agreement's name and an "Open document" button that opens the panel. It follows brand.md and the design sources in work/PAR-1/design/. It must not show on phones (they have tabs) or when no agreement is picked yet, and it must be keyboard- and screen-reader-friendly. Tests: a browser test and an e2e step in shell.spec.ts (close, card shows, click opens the panel).` },
  { key: 'polish', port: 3163, items: ['PAR-45'], skills: 'agent-skills:frontend-ui-engineering, emil-design-eng, web-design-guidelines', specs: 'e2e/visual.spec.ts e2e/a11y.spec.ts e2e/auth.spec.ts e2e/pricing.spec.ts e2e/editing.spec.ts e2e/first-run.spec.ts',
    focus: `Design polish, the owner's picks (see the last log entry of PAR-45 and its notes; screenshots in work/PAR-1/qa/):
1. Dark-mode highlighter under the start headline: a softer yellow instead of the muddy olive (#4B3F14).
2. Pricing in dark mode: the Pro card gets its emphasis back (e.g. a blue-tint border or lighter surface).
3. Auth pages (sign-in, sign-up, forgot/reset password, verify-email) and Settings: on brand, like the start and pricing pages: Newsreader card titles at Title size, more air, one ink button per page, even padding.
4. The inline field editor: one frame (brand.md: a single 1.5px border with a 3px halo), serif text inside, like the contract.
5. Start page at 2560: a max width for the whole landing so it is not left-heavy.
6. brand.md: say unchosen option lines use 85% opacity (the build), not 42%.
Skip: auto-collapsing the sidebar on tablets.
Check each change with screenshots in light and dark at 375, 1440 and 2560 px (agent-browser or Playwright), and keep contrast passing. Update visual.spec.ts baselines only where these changes are the intended difference, and list them.` },
]

const RULES = (l) => `
Hard rules (owner decisions):
- Only e2e runs under the lock: \`PORT=${l.port} flock ${E2E_LOCK} pnpm test:e2e --project=chromium --project=firefox <spec files>\` from apps/web (phone-only specs need --project=chromium-phone --project=firefox-phone). Never leave a dev server running. Run only related tests while working; the full gate once at the end.
- Local Postgres (db:dev, port 54320) is shared: never stop it. If it is down, start it detached (\`cd ${REPO} && nohup pnpm db:dev >/dev/null 2>&1 &\`) and leave it running. Port 3000 belongs to another app. Known flakes: \`wi show PAR-8\`. The first full \`pnpm test\` in a fresh worktree can fail from Vite "optimized dependencies changed. reloading"; run it again before you believe a failure.
- Tests use scripted AI; no real model calls. No Resend sends.
- Git: commits are \`<type>(<item id>): <why>\` ending with the line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>. Never push, merge, rebase or change branches.
- Scope: only ${l.items.join(', ')}. Two other lanes work at the same time (PAR-40+42 choices, PAR-44 reopen card, PAR-45 design polish); keep to the files your items need. Do not run \`wi\` and do not edit work/PAR-1/todo.md.
- Never touch production, never delete cloud resources.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    lane: { type: 'string' }, worktreePath: { type: 'string' }, branch: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, done: { type: 'boolean' }, what: { type: 'string' },
      tests: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
    }, required: ['id', 'done', 'what', 'tests', 'commits', 'notes'] } },
    screenshots: { type: 'array', items: { type: 'string' }, description: 'paths of before/after screenshots' },
    baselinesUpdated: { type: 'array', items: { type: 'string' } },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string' },
    ownerDecisions: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['lane', 'worktreePath', 'branch', 'items', 'screenshots', 'baselinesUpdated', 'skillsFollowed', 'gates', 'ownerDecisions', 'openIssues'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
      item: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' }, issue: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'item', 'file', 'issue', 'fix'] } },
    acceptGaps: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
    skillsLoaded: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'acceptGaps', 'verdict', 'skillsLoaded'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, why: { type: 'string' } }, required: ['finding', 'why'] } },
    commits: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string' }, openIssues: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' },
  },
  required: ['fixed', 'skipped', 'commits', 'gates', 'openIssues', 'done'],
}

return await pipeline(
  LANES,
  (l) => agent(`You are doing lane "${l.key}" of work item PAR-1 (Parley): ${l.items.join(', ')}. You are in your own fresh git worktree of ${REPO}, on your own branch.

${l.focus}
${RULES(l)}
Steps:
1. Setup: \`git log --oneline -1\`; if HEAD is not ${BASE}, \`git reset --hard ${BASE}\` (your own new branch, before any work). Copy ${REPO}/.env to the worktree root and ${REPO}/apps/web/.dev.vars to apps/web/.dev.vars (never commit them). \`pnpm install --frozen-lockfile\`.
2. Read \`wi show <id>\` for each item (the owner's decision is in its last log entries), work/PAR-1/brand.md, and the related part of work/PAR-1/qa.md. Load agent-skills:test-driven-development, agent-skills:git-workflow-and-versioning and ${l.skills} with the Skill tool, and follow them.
3. Test first where behavior changes; screenshots for visual changes. Commit per item or per change.
4. Gate once at the end: \`pnpm check\`, \`pnpm test\`, and e2e for ${l.specs} (Chromium + Firefox, PORT=${l.port}).
Return the structured result. worktreePath = \`pwd\` at the worktree root; branch = \`git branch --show-current\`.`,
    { label: `build:${l.key}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }),

  (b, l) => b && agent(`Review lane "${l.key}" (${l.items.join(', ')}) of PAR-1 (Parley) before it merges. Worktree ${b.worktreePath}, branch ${b.branch}; do not edit files. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`. Items: \`wi show <id>\` (the owner's decisions are in the last log entries).
Load agent-skills:code-review-and-quality and follow it (five axes), plus web-design-guidelines for the UI parts. Check each owner decision is done as decided (gaps in acceptGaps), the UI follows work/PAR-1/brand.md in light and dark (look at the builder's screenshots), accessibility holds, and any updated visual baseline is an intended change. Concrete findings only (item, file, failure, fix). Read only: no test runs, builds or dev servers.
Builder report (verify, don't trust): ${JSON.stringify(b)}`,
    { label: `review:${l.key}`, phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'agent-skills:code-reviewer' })
    .then((r) => r && { b, r }),

  (x, l) => {
    if (!x) return null
    const needsFix = x.r.acceptGaps.length > 0 || x.r.findings.some((f) => f.severity !== 'suggestion')
    if (!needsFix) return { build: x.b, review: x.r, fix: null }
    return agent(`Finish lane "${l.key}" (${l.items.join(', ')}) of PAR-1 (Parley). Worktree ${x.b.worktreePath} (branch ${x.b.branch}); cd there, edit only under that path, never ${REPO} itself.
${RULES(l)}
Fix every critical/important finding and acceptGap, test-first where it is behavior. Suggestions only if clearly right and cheap; say why you skip any. Commit each fix. Then the gate once: \`pnpm check\`, \`pnpm test\`, e2e for ${l.specs} (PORT=${l.port}).
Build report: ${JSON.stringify(x.b)}
Review: ${JSON.stringify(x.r)}`,
      { label: `fix:${l.key}`, phase: 'Fix', schema: FIX_SCHEMA })
      .then((f) => ({ build: x.b, review: x.r, fix: f }))
  },
)
