export const meta = {
  name: 'par1-wave-t36',
  description: 'PAR-1 T36 wave: fix PAR-29 + PAR-6 in worktrees (build, review, fix) while 3 QA agents dogfood the Preview',
  phases: [
    { title: 'Build', detail: 'PAR-29 and PAR-6, one worktree each, test-first' },
    { title: 'Review', detail: 'fresh five-axis review of each fix branch' },
    { title: 'Fix', detail: 'fix review findings, re-run gates' },
    { title: 'QA', detail: 'T36 exploratory QA on the Preview, 3 areas, report only' },
  ],
}

const REPO = '/home/velkyr/Projects/parley'
const SCRATCH = '/tmp/claude-1000/-home-velkyr-Projects-parley/7e9a623f-551e-4f9e-a6ce-a76da6886f65/scratchpad'
const LOCK = `${SCRATCH}/heavy.lock`
const ALERTS = `${SCRATCH}/owner-alerts.txt`
const BASE = '217b041'
const PREVIEW = 'https://par-1-parley-parley.vaelorashbound.workers.dev'

const FIXES = [
  { id: 'PAR-29', port: 3141, spec: 'e2e/phone.spec.ts', focus: `Phone: the sidebar "New draft" button (apps/web/src/routes/-components/shell/app-sidebar.tsx) links to "/" without closing the phone drawer. Fix like PAR-12 (commit 7e97e4f, draft-history.tsx): onClick setOpenMobile(false). Also check the other links in the same drawer that navigate (the logo "Parley home" links, the guest "Sign in") and close the drawer on those too if they have the same bug. Test: a started browser test is at ${SCRATCH}/app-sidebar.browser.test.tsx (copy it to apps/web/src/routes/-components/shell/). It mocks ./account-menu (server imports). Its last run failed with "useTheme must be used within a ThemeProvider" (ThemeToggle): wrap in the app's ThemeProvider or mock ./theme-toggle, then see it fail for the right reason before fixing. Run it with \`flock ${LOCK} pnpm test:browser <file>\`.` },
  { id: 'PAR-6', port: 3142, spec: 'the draft/layout e2e spec (find it) or a new e2e/no-sideways-scroll.spec.ts', focus: `Draft page scrolls sideways when the document panel is closed. Read \`wi show PAR-6\` for the measurements: with ?panel=closed the page is 1368 px wide in a 1280 px window; main scrollWidth 1112 vs 1024; start from the collapsed document panel (its header and the px-9 scroller sit at x 1280-1352). Load agent-skills:debugging-and-error-recovery: reproduce first (Playwright or agent-browser at 1280 px), find the root cause, no overflow-hidden band-aid unless it is the right fix. Done when: no draft page scrolls sideways at 1440, 1280 and 390 px, panel open or closed, and an e2e test checks document.documentElement scrollWidth === clientWidth (and main's) in those 6 cases. Also load frontend-ui-engineering.` },
]

const RULES = (t) => `
Hard rules (owner decisions, work/PAR-1/plan.md "## Parallel run"):
- RAM: 16 GB laptop. EVERY heavy command runs under the shared lock: \`flock ${LOCK} <command>\`. Heavy = pnpm install, dev server, any test run, pnpm check / vp check, builds, and git commit (pre-commit runs vp check). Never leave a dev server running. Run only related tests while working; the full gate once at the end. e2e: \`PORT=${t.port} flock ${LOCK} pnpm test:e2e --project=chromium --project=firefox <spec files>\` (needs \`pnpm db:dev\` running; check with the lead's setup, start it if not). Port 3000 is another app's: never use it. Known flakes that are not yours: \`wi show PAR-8\`.
- Git: commits are \`<type>(${t.id}): <why>\` and end with the line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>. Never push, merge, rebase or change branches.
- Scope: only ${t.id}. Another fix and a QA run happen at the same time. Do not run \`wi\` (the lead logs). Do not edit work/PAR-1/todo.md.
- Never touch production or delete cloud resources.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    task: { type: 'string' }, worktreePath: { type: 'string' }, branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    rootCause: { type: 'string' }, summary: { type: 'string' },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string', description: 'exact commands and pass/fail counts' },
    openIssues: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean' },
  },
  required: ['task', 'worktreePath', 'branch', 'commits', 'rootCause', 'summary', 'skillsFollowed', 'gates', 'openIssues', 'done'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
      file: { type: 'string' }, line: { type: 'number' }, issue: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'file', 'issue', 'fix'] } },
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
const QA_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    covered: { type: 'array', items: { type: 'string' }, description: 'journeys/sizes/themes actually exercised' },
    notCovered: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, why: { type: 'string' } }, required: ['what', 'why'] } },
    bugs: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string', description: 'wi-style one line: what is wrong, where' },
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      steps: { type: 'string' }, expected: { type: 'string' }, actual: { type: 'string' },
      evidence: { type: 'string', description: 'screenshot paths, console errors, numbers' },
      likelyFile: { type: 'string' },
    }, required: ['title', 'severity', 'steps', 'expected', 'actual', 'evidence'] } },
    feelNotes: { type: 'array', items: { type: 'string' }, description: 'non-bug design/feel observations worth the owner seeing' },
    checkedKnown: { type: 'array', items: { type: 'string' }, description: 'status of PAR-7/PAR-30/PAR-20/PAR-21 if touched' },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
  },
  required: ['area', 'covered', 'notCovered', 'bugs', 'feelNotes', 'checkedKnown', 'skillsFollowed'],
}

const QA_COMMON = `You are doing part of T36 (Exploratory QA pass) for PAR-1 (Parley, an AI legal-agreement drafting app). Read the T36 block in ${REPO}/work/PAR-1/todo.md, spec.md §1 for the journeys, and brand.md for the intended feel. Test the live Preview: ${PREVIEW} (same code as the branch HEAD). Load agent-browser (and agent-skills:browser-testing-with-devtools; web-design-guidelines for layout/feel) and follow them. Use your own agent-browser session name so you don't clash with the 2 other QA agents.
Rules:
- REPORT ONLY. Do not edit the repo, do not commit, do not run \`wi\`. You may read code to point at likelyFile. Screenshots go under ${SCRATCH}/qa/<your area>/.
- Free AI on the Preview: set the cookie parley-scripted-ai=1 on the Preview domain before chatting (see apps/web/src/server/ai/model.ts; SCRIPTED_AI is on for Previews). Only drop it when you must see one real reply, at most 3 real messages.
- Resend quota is small: at most 2 real sign-up/verification emails in total for your area, to delivered@resend.dev style test addresses or your own. On a quota/429 error stop sending and append "T36 RESEND QUOTA: <error>" to ${ALERTS}.
- Polar is sandbox only (test card 4242 4242 4242 4242). Never production.
- Known, being fixed right now in parallel, do NOT report: PAR-29 (phone drawer stays open after New draft), PAR-6 (draft page scrolls sideways with the panel closed). Other known items: \`wi show PAR-7\`, \`wi show PAR-30\`, \`wi show PAR-8\`, \`wi show PAR-20\`, \`wi show PAR-21\` (read them; report their status in checkedKnown if you touch them, not as new bugs).
- If Turnstile or anything blocks automation, note it in notCovered; do not try to bypass it.
- A bug needs real evidence (repro steps you ran, a screenshot or console text). Mark severity high only for data loss, broken core journey, security, or a11y blocker.
Your area:`

const QA_AREAS = [
  { key: 'journeys', prompt: `Core journeys, desktop 1440 and 1280 px, light and dark: the start page (reveal, starters, library of eleven agreements), a guest drafting an NDA from one sentence through chat to a filled document, clicking values to edit, the questionnaire, Try again, undo, the document panel open/closed/resized, export PDF and DOCX (open the files, check they look right), share link (open it in a fresh session, revoke it), search (Ctrl+K), draft history rename/duplicate/delete+undo. Edge cases: empty message, very long message, fast double send, reload mid-reply, back/forward, a bad /d/<id> and /s/<token> URL, offline for a moment.` },
  { key: 'sizes-feel', prompt: `Layout and feel at many sizes: 390x844 and 375x667 phones, 768 and 1024 tablets, 1180, 1440, 1920 and 2560 desktops, light and dark, reduced motion and zoom 200%. Pages: start, draft (chat + document), drafts list, settings, pricing, sign-in/up, share view, 404. Check overflow, clipping, overlaps, tap targets, focus rings, keyboard-only use of the whole draft journey, screen-reader names (agent-browser snapshot), headings, contrast in dark mode, motion quality vs brand.md. This is also the "Claude in Chrome feel check" T37 left for T36: judge whether it looks like an Apple/Linear-grade product and write concrete feelNotes.` },
  { key: 'account-memory', prompt: `Accounts and long sessions: sign up (email + password), verify email, sign in/out, a guest's draft kept after sign-in, password reset, two-factor setup + sign-in challenge + backup code (Settings), upgrade to Pro through Polar sandbox checkout and back, billing portal, free daily message limit message, delete account if offered. Then the memory check: with Chrome DevTools (load agent-skills:browser-testing-with-devtools; if the chrome-devtools MCP is not available use agent-browser + performance.memory / heap snapshots via CDP) run a 100-message chat with scripted AI and record JS heap and DOM node count at 0, 25, 50, 75, 100 messages (force GC before each if you can). Report the numbers in evidence, and a bug if they grow without bound or the page slows (input lag, scroll jank).` },
]

const fixLane = pipeline(
  FIXES,
  (t) => agent(`You are fixing ${t.id} for work item PAR-1 (Parley) in your own fresh git worktree of ${REPO}, on your own branch.

${t.focus}
${RULES(t)}
Steps:
1. Setup: run \`git log --oneline -1\`; if HEAD is not ${BASE}, \`git reset --hard ${BASE}\` (your own new branch, before any work). Copy ${REPO}/.env to the worktree root and ${REPO}/apps/web/.dev.vars to apps/web/.dev.vars (never commit them). \`flock ${LOCK} pnpm install --frozen-lockfile\`.
2. Read \`wi show ${t.id}\`. Load agent-skills:test-driven-development (Prove-It pattern for bugs) and agent-skills:git-workflow-and-versioning, plus the skills named above, and follow them.
3. Write the failing test first and see it fail for the right reason. Fix. See it pass. Commit.
4. Gate once at the end: \`flock ${LOCK} pnpm check\`, \`flock ${LOCK} pnpm test\`, and e2e for ${t.spec} (Chromium + Firefox, PORT=${t.port}).
Return the structured result. worktreePath = \`pwd\` at the worktree root; branch = \`git branch --show-current\`.`,
    { label: `build:${t.id}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }),

  (b, t) => b && agent(`Review the ${t.id} fix of PAR-1 (Parley) before it merges. Worktree ${b.worktreePath}, branch ${b.branch}; do not edit files. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`. Issue: \`wi show ${t.id}\`.
Load agent-skills:code-review-and-quality and follow it (five axes). Check the root cause is really fixed (not a band-aid), the done-when of the issue is met (list gaps in acceptGaps), and the tests would fail without the fix. Concrete findings only (file, failure, fix). Read only: no test runs, builds or dev servers.
Builder report (verify, don't trust): ${JSON.stringify(b)}`,
    { label: `review:${t.id}`, phase: 'Review', schema: REVIEW_SCHEMA, agentType: 'agent-skills:code-reviewer' })
    .then((r) => r && { b, r }),

  (x, t) => {
    if (!x) return null
    const needsFix = x.r.acceptGaps.length > 0 || x.r.findings.some((f) => f.severity !== 'suggestion')
    if (!needsFix) return { build: x.b, review: x.r, fix: null }
    return agent(`Finish ${t.id} of PAR-1 (Parley). Worktree ${x.b.worktreePath} (branch ${x.b.branch}); cd there, edit only under that path, never ${REPO} itself.
${RULES(t)}
Fix every critical/important finding and acceptGap, test-first. Suggestions only if clearly right and cheap; say why you skip any. Commit each fix. Then the gate once: \`flock ${LOCK} pnpm check\`, \`flock ${LOCK} pnpm test\`, e2e for ${t.spec} (PORT=${t.port}).
Build report: ${JSON.stringify(x.b)}
Review: ${JSON.stringify(x.r)}`,
      { label: `fix:${t.id}`, phase: 'Fix', schema: FIX_SCHEMA })
      .then((f) => ({ build: x.b, review: x.r, fix: f }))
  },
)

const qaLane = parallel(QA_AREAS.map((a) => () =>
  agent(`${QA_COMMON} ${a.key}. ${a.prompt}`, { label: `qa:${a.key}`, phase: 'QA', schema: QA_SCHEMA })))

const [fixes, qa] = await Promise.all([fixLane, qaLane])
return { fixes, qa }
