export const meta = {
  name: 'par1-wave-b2',
  description: 'PAR-1 wave B2: build, review, fix+simplify T25, T27, T28 in parallel worktrees',
  phases: [
    { title: 'Build', detail: 'one agent per task in its own worktree: /build + /test' },
    { title: 'Review', detail: 'fresh five-axis review of each task branch' },
    { title: 'Fix', detail: 'fix review findings, /code-simplify, re-run gates' },
  ],
}

const REPO = '/home/velkyr/Projects/parley'
// Workflow script for wave B2 (see plan.md "Parallel run"). A new session:
// set SCRATCH to its own scratchpad dir and BASE to the branch HEAD first.
const SCRATCH = '/tmp/claude-1000/-home-velkyr-Projects-parley/84376620-febc-4fce-8e8c-4c08ef8cdad2/scratchpad'
const LOCK = `${SCRATCH}/heavy.lock`
const ALERTS = `${SCRATCH}/owner-alerts.txt`

const BASE = 'fb92e5f'
const TASKS = [
  { id: 'T25', port: 3131, reviewSkills: 'agent-skills:security-and-hardening, since share links expose data',  focus: 'share links: security matters most (load agent-skills:security-and-hardening). Read-only links must never leak other drafts, the chat, or who owns them; think about token guessing, revocation, caching (no shared cache of private pages), and noindex.' },
  { id: 'T27', port: 3132, reviewSkills: 'agent-skills:security-and-hardening and better-auth-security-best-practices, since this is abuse protection',  focus: 'Turnstile, rate limits, AI budgets. Read the two extra Musts in the T27 block (export rate limit from T24; /sign-in/anonymous in the captcha endpoints from T21). Also fix PAR-11 on the way, test first: useTurnstile().headers() in apps/web/src/features/auth/turnstile.tsx must reset the live widget after each send (call ref.current?.reset() in finally), so a second send gets a new token. The Rate Limiting binding is config in wrangler.jsonc (a dev/test resource on previews).' },
  { id: 'T28', port: 3133, reviewSkills: 'agent-skills:doubt-driven-development, since deletes are irreversible',  focus: 'Cron: purge old guest data. Deletes are irreversible: load agent-skills:doubt-driven-development, and prove with tests that only expired guest data is removed (never accounts, never a guest who just linked). Keep Neon egress low (load neon:neon-postgres-egress-optimizer): delete in bounded batches.' },
]

const RULES = (t) => `
Hard rules (owner decisions; also in the "## Parallel run" section of work/PAR-1/plan.md):
- RAM: the laptop has 16 GB. EVERY heavy command runs under the shared lock: \`flock ${LOCK} <command>\`. Heavy = pnpm install, pnpm dev, any test run (pnpm test, test:workers, test:browser, test:e2e, test:coverage, evals), pnpm check / vp check, builds, and git commit (the pre-commit hook runs vp check). Never leave a dev server running. Speed: while building, run only the tests for what you touched (\`flock ${LOCK} pnpm vp test run <test files>\`, or one Worker test file with \`flock ${LOCK} pnpm test:workers -- <file>\`); never the whole suite per slice. The full gate runs ONCE, at the end of your stage. For e2e run only your area's spec files: \`PORT=${t.port} flock ${LOCK} pnpm test:e2e --project=chromium --project=firefox e2e/<your spec>.spec.ts\` (Playwright starts and stops the server; WebKit can't run here). The lead runs the whole e2e suite after merge, and CI runs it on the Preview. Known flaky tests that are NOT yours: PAR-8 in work/PAR-8 and \`wi show PAR-8\`. If you need a server for a manual check, start it, check, and kill it inside ONE flock'd bash -c script. Port 3000 belongs to another app: never use it.
- Resend: the owner's free quota can run out. Tests use a fake/in-memory sender. At most 3 real Resend sends for this task, to Resend test addresses. If Resend returns a quota or rate-limit error (429, daily/monthly quota), stop all sends and immediately append one line to ${ALERTS}: "<task> RESEND QUOTA: <error text>".
- Cloud: you may create dev/test resources (e.g. a Turnstile widget, Worker Preview secrets). Never touch production (no production secrets, deploys, or Neon production), never delete anything, never run migrations against Neon (generate them locally only; the lead applies them). Anything that needs the owner goes in ownerSteps, and anything urgent also as a line in ${ALERTS}.
- Git: commits are \`<type>(PAR-1): <why>\` and end with these two trailer lines:
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011dejXDVQUD6iNqFi4wrteW
  Never push, never merge, never rebase onto other branches, never change branches.
- Scope: only ${t.id}. Other tasks (T25, T27, T28) are being built at the same time in other worktrees; do not do their work. If you need something from another task, note it in openIssues. New DB migrations and new ADR files are fine; the lead renumbers them at merge.
- In work/PAR-1/todo.md, only edit the ${t.id} block (tick it and add short done notes, in the style of earlier done tasks).
`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    task: { type: 'string' },
    worktreePath: { type: 'string' },
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string', description: 'exact commands run and pass/fail counts' },
    migrations: { type: 'array', items: { type: 'string' } },
    adrs: { type: 'array', items: { type: 'string' } },
    ownerSteps: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean', description: 'true only if every Accept item is met and gates are green' },
  },
  required: ['task', 'worktreePath', 'branch', 'commits', 'summary', 'skillsFollowed', 'gates', 'migrations', 'adrs', 'ownerSteps', 'openIssues', 'done'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
          file: { type: 'string' },
          line: { type: 'number' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'issue', 'fix'],
      },
    },
    acceptGaps: { type: 'array', items: { type: 'string' }, description: 'todo Accept/Verify items not actually met' },
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
    simplifications: { type: 'array', items: { type: 'string' } },
    commits: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string' },
    ownerSteps: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean' },
  },
  required: ['fixed', 'skipped', 'simplifications', 'commits', 'gates', 'ownerSteps', 'openIssues', 'done'],
}

const results = await pipeline(
  TASKS,
  (t) => agent(`You are building task ${t.id} of work item PAR-1 (Parley). You are in your own fresh git worktree of ${REPO}, on your own branch. The spec and plan are approved; the owner approved ${t.id} as written.

Focus: ${t.focus}
${RULES(t)}
Steps:
1. Setup: copy ${REPO}/.env to the worktree root and ${REPO}/apps/web/.dev.vars to apps/web/.dev.vars (never commit them). Run \`flock ${LOCK} pnpm install --frozen-lockfile\`.
2. Read the ${t.id} block in work/PAR-1/todo.md, the spec sections it relies on (work/PAR-1/spec.md), the "Skills per task" row for ${t.id} plus the always-on list in work/PAR-1/plan.md, and the done notes of the tasks it depends on. Load every skill in that row and the always-on process skills with the Skill tool, and follow them as binding workflows (source-driven: check library APIs in current docs before coding).
3. Build it the /build way (agent-skills:build → incremental-implementation + test-driven-development): thin slices, failing test first, code, gate, commit, next slice.
4. Verify it the /test way: every Accept and Verify item in the todo block. Run the full gate before finishing: \`flock ${LOCK} pnpm check\`, \`flock ${LOCK} pnpm test\`, \`flock ${LOCK} pnpm test:workers\`, plus e2e for your area's specs only (Chromium + Firefox) with PORT=${t.port}. Once, at the end. Items only the owner can do go in ownerSteps.
5. Tick ${t.id} in todo.md with done notes naming the skills you followed, and commit.
Return the structured result. worktreePath = output of \`pwd\` at the worktree root; branch = \`git branch --show-current\`.`,
    { label: `build:${t.id}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }),

  (b, t) => b && agent(`Review task ${t.id} of PAR-1 (Parley) before it merges. The work is in the git worktree ${b.worktreePath} on branch ${b.branch}; cd there for every command and do not edit any file. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`.

Load agent-skills:code-review-and-quality and follow it: five axes (correctness, readability, architecture, security, performance)${t.reviewSkills ? `, plus ${t.reviewSkills} (load them too)` : ''}. Check the work against the ${t.id} block in work/PAR-1/todo.md (Accept + Verify) and the spec; list any unmet item in acceptGaps. Check the tests really prove the behavior (would they fail if the code were wrong?). Be adversarial and concrete: each finding needs a file, the failure it causes, and the fix. Only report real problems, not style taste.
Read only: do not run tests, builds or dev servers (the fix step runs the gate). In skillsLoaded, list every skill you loaded with the Skill tool.

The builder's own report, for context (verify it, do not trust it): ${JSON.stringify(b)}`,
    { label: `review:${t.id}`, phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'agent-skills:code-reviewer' })
      .then((r) => r && { b, r }),

  (x, t) => x && agent(`Finish task ${t.id} of PAR-1 (Parley). The work is in the git worktree ${x.b.worktreePath} (branch ${x.b.branch}); cd there for every command, and every file you edit must be under that path. Never edit ${REPO} itself.
${RULES(t)}
1. Fix every critical and important review finding and every acceptGap, test-first (a failing test that shows the problem, then the fix). Fix suggestions only when clearly right and cheap. If you skip one, say why.
2. Then run /code-simplify on this task's diff: load agent-skills:code-simplification and follow it (behavior stays the same, tests stay green).
3. Re-run the full gate: \`flock ${LOCK} pnpm check\`, \`flock ${LOCK} pnpm test\`, \`flock ${LOCK} pnpm test:workers\`, and e2e for your area's specs only with PORT=${t.port}. Once, at the end; while fixing, run only the related tests. Commit each fix and each simplification separately.

Build report: ${JSON.stringify(x.b)}
Review: ${JSON.stringify(x.r)}`,
    { label: `fix:${t.id}`, phase: 'Fix', schema: FIX_SCHEMA })
      .then((f) => ({ build: x.b, review: x.r, fix: f })),
)

return results
