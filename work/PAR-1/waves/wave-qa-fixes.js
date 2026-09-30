export const meta = {
  name: 'par1-wave-qa-fixes',
  description: 'PAR-1 QA fixes wave: 4 lanes (document sync, chat, questionnaire, small fixes) in worktrees: build, review, fix',
  phases: [
    { title: 'Build', detail: 'one agent per lane in its own worktree, test-first, one commit per item' },
    { title: 'Review', detail: 'fresh five-axis review of each lane branch' },
    { title: 'Fix', detail: 'fix review findings, re-run gates' },
  ],
}

const REPO = '/home/velkyr/Projects/parley'
const SCRATCH = '/tmp/claude-1000/-home-velkyr-Projects-parley/7e9a623f-551e-4f9e-a6ce-a76da6886f65/scratchpad'
const E2E_LOCK = `${SCRATCH}/e2e.lock`
const ALERTS = `${SCRATCH}/owner-alerts.txt`
const BASE = 'df59321'

const LANES = [
  { key: 'doc-sync', port: 3151, items: ['PAR-32'], skills: 'agent-skills:debugging-and-error-recovery, agent-skills:source-driven-development (TanStack Query cancelQueries/invalidateQueries/setQueryData ordering, AI SDK tool parts)', specs: 'e2e/chat.spec.ts e2e/editing.spec.ts',
    focus: 'The HIGH bug that blocks Checkpoint 7. Reproduce first (scripted AI, fresh guest, first message; QA saw it 2 of 4 runs). Find the real race (QA suspects tool-chooseDocument invalidateQueries refetch landing after tool-updateFields setQueryData in apps/web/src/features/chat/use-document-sync.ts). Write a test that forces the late refetch and fails, then fix at the root (not a delay).' },
  { key: 'chat', port: 3152, items: ['PAR-34', 'PAR-33', 'PAR-39', 'PAR-37'], skills: 'agent-skills:debugging-and-error-recovery, agent-skills:frontend-ui-engineering, agent-skills:source-driven-development (AI SDK useChat resume/reconnect, the message-scroller component)', specs: 'e2e/chat.spec.ts e2e/limits.spec.ts',
    focus: 'Four chat bugs that share files (chat-panel, composer, transport, message-scroller). Do them one at a time in this order, one commit (or a few) per item, each test-first: PAR-34 (refused send scrolls chat to top, limit notice off screen), PAR-33 (reload mid-reply: reply shows only after a second reload), PAR-39 (send guard must be a ref, atomic), PAR-37 (4000-char limit cuts pasted text silently: show it, e.g. a counter near the limit, never cut silently; follow brand.md).' },
  { key: 'questionnaire', port: 3153, items: ['PAR-35'], skills: 'agent-skills:frontend-ui-engineering, web-design-guidelines (focus management)', specs: 'e2e/keyboard.spec.ts e2e/chat.spec.ts e2e/a11y.spec.ts',
    focus: 'Questionnaire focus: moving to a text step must focus its input (typing is lost today, focus is on the fieldset), and after Send answers focus must go somewhere sensible (the composer) instead of <body>. Also read `wi show PAR-30` (keyboard golden-path e2e never sends): check if this is its cause, and if your fix makes that path work, say so in the result (the lead updates PAR-30).' },
  { key: 'small', port: 3154, items: ['PAR-36', 'PAR-38', 'PAR-40', 'PAR-41', 'PAR-42'], skills: 'agent-skills:frontend-ui-engineering, web-design-guidelines', specs: 'e2e/shell.spec.ts e2e/a11y.spec.ts e2e/export.spec.ts e2e/drafts.spec.ts',
    focus: 'Five small, unrelated fixes. One commit (or a few) per item, each test-first: PAR-36 (bad /d/<not a uuid> is a 404 not a 500; 404 pages get an h1, main landmark, real <title>, the app shell where it fits, and Sign in for a signed-out visitor), PAR-38 (search with no word characters must not list every draft; test in packages/db), PAR-40 (an empty optional field prints blank or is left out in PDF and DOCX, never its [placeholder]; keep the T31 export baselines passing, update a baseline only if the change is the intended fix), PAR-41 (clean accessible names: h1, h2, composer group, sign-in button without "Last used"; round the separator aria-valuenow; More button at least 24 px; only one Toggle Sidebar in the tab order), PAR-42 (change marker: the full new value must be readable and in its accessible name).' },
]

const RULES = (l) => `
Hard rules (owner decisions):
- Heavy commands: no lock, EXCEPT e2e, which runs under \`flock ${E2E_LOCK} ...\` because 4 lanes run at once on a 16 GB laptop. Never leave a dev server running. While working, run only related tests; the full gate once at the end.
- e2e: \`PORT=${l.port} flock ${E2E_LOCK} pnpm test:e2e --project=chromium --project=firefox <spec files>\` from apps/web (phone-only specs need --project=chromium-phone --project=firefox-phone). Local Postgres (db:dev, port 54320) is shared and already running: never stop it. If it is down, start it detached (\`cd ${REPO} && nohup pnpm db:dev >/dev/null 2>&1 &\`) and leave it running. Port 3000 belongs to another app. Known flakes, not yours: \`wi show PAR-8\`. A first full \`pnpm test\` in a fresh worktree can fail from Vite "optimized dependencies changed. reloading"; run it again before you believe a failure.
- Free AI: tests use scripted AI. At most 3 real model calls for this lane, only if a bug needs it. Resend: at most 2 real sends; on a quota/429 error stop and append "<lane> RESEND QUOTA: <error>" to ${ALERTS}.
- Git: commits are \`<type>(<item id>): <why>\` using the item the commit is for, ending with the line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>. Never push, merge, rebase or change branches.
- Scope: only ${l.items.join(', ')}. Three other lanes work at the same time (document sync PAR-32, chat PAR-33/34/37/39, questionnaire PAR-35, small fixes PAR-36/38/40/41/42); don't do their work, and keep your changes to the files your items need so the merges stay clean. Do not run \`wi\` (the lead logs) and do not edit work/PAR-1/todo.md.
- Never touch production, never delete cloud resources.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    lane: { type: 'string' }, worktreePath: { type: 'string' }, branch: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, done: { type: 'boolean' }, rootCause: { type: 'string' }, fix: { type: 'string' },
      tests: { type: 'string', description: 'test files, and proof they failed before the fix' },
      commits: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
    }, required: ['id', 'done', 'rootCause', 'fix', 'tests', 'commits', 'notes'] } },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string', description: 'exact commands and pass/fail counts' },
    ownerDecisions: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['lane', 'worktreePath', 'branch', 'items', 'skillsFollowed', 'gates', 'ownerDecisions', 'openIssues'],
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
  (l) => agent(`You are fixing bugs found by the T36 QA pass of work item PAR-1 (Parley), lane "${l.key}": ${l.items.join(', ')}. You are in your own fresh git worktree of ${REPO}, on your own branch.

${l.focus}
${RULES(l)}
Steps:
1. Setup: \`git log --oneline -1\`; if HEAD is not ${BASE}, \`git reset --hard ${BASE}\` (your own new branch, before any work). Copy ${REPO}/.env to the worktree root and ${REPO}/apps/web/.dev.vars to apps/web/.dev.vars (never commit them). \`pnpm install --frozen-lockfile\`.
2. Read \`wi show <id>\` for each item (steps, evidence, done-when) and the related part of work/PAR-1/qa.md; screenshots are in work/PAR-1/qa/. Load agent-skills:test-driven-development (Prove-It pattern), agent-skills:git-workflow-and-versioning and ${l.skills} with the Skill tool, and follow them.
3. Per item: reproduce, write the failing test, see it fail for the right reason, fix the root cause, see it pass, commit. If an item needs an owner decision (design or spec), do the safe part and put the question in ownerDecisions.
4. Gate once at the end: \`pnpm check\`, \`pnpm test\`, and e2e for ${l.specs} plus any spec you added (Chromium + Firefox, PORT=${l.port}).
Return the structured result. worktreePath = \`pwd\` at the worktree root; branch = \`git branch --show-current\`.`,
    { label: `build:${l.key}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }),

  (b, l) => b && agent(`Review lane "${l.key}" (${l.items.join(', ')}) of PAR-1 (Parley) before it merges. Worktree ${b.worktreePath}, branch ${b.branch}; do not edit files. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`. Items: \`wi show <id>\` for each.
Load agent-skills:code-review-and-quality and follow it (five axes)${l.key === 'small' || l.key === 'questionnaire' ? ', plus web-design-guidelines for the a11y/UI parts' : ''}. For each item check: the root cause is really fixed (not a band-aid), its done-when is met (list gaps in acceptGaps with the item id), and its test would fail without the fix. Concrete findings only (item, file, failure, fix). Read only: no test runs, builds or dev servers.
Builder report (verify, don't trust): ${JSON.stringify(b)}`,
    { label: `review:${l.key}`, phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'agent-skills:code-reviewer' })
    .then((r) => r && { b, r }),

  (x, l) => {
    if (!x) return null
    const needsFix = x.r.acceptGaps.length > 0 || x.r.findings.some((f) => f.severity !== 'suggestion')
    if (!needsFix) return { build: x.b, review: x.r, fix: null }
    return agent(`Finish lane "${l.key}" (${l.items.join(', ')}) of PAR-1 (Parley). Worktree ${x.b.worktreePath} (branch ${x.b.branch}); cd there, edit only under that path, never ${REPO} itself.
${RULES(l)}
Fix every critical/important finding and acceptGap, test-first. Suggestions only if clearly right and cheap; say why you skip any. Commit each fix with the item id it belongs to. Then the gate once: \`pnpm check\`, \`pnpm test\`, e2e for ${l.specs} and any spec the lane added (PORT=${l.port}).
Build report: ${JSON.stringify(x.b)}
Review: ${JSON.stringify(x.r)}`,
      { label: `fix:${l.key}`, phase: 'Fix', schema: FIX_SCHEMA })
      .then((f) => ({ build: x.b, review: x.r, fix: f }))
  },
)
