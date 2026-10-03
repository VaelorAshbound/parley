export const meta = {
  name: 'parley-wave-1',
  description: 'Wave 1 after PAR-1: five bug-fix lanes (PAR-7+52, PAR-13+31, PAR-14, PAR-51, PAR-50) proved by a failing test, fixed, then attacked and reviewed',
  phases: [
    { title: 'Prove & fix', detail: 'one agent per lane in its own worktree: failing test first, then the fix' },
    { title: 'Attack', detail: 'per lane: a breaker tries to defeat the fix, a reviewer does the five-axis review' },
    { title: 'Close', detail: 'fix what the attack and review found, run the lane gate' },
  ],
}

const REPO = '/home/velkyr/Projects/parley'
const SCRATCH = '/tmp/claude-1000/-home-velkyr-Projects-parley/02c4ab9d-2843-42b9-a4ca-e4b49214ce23/scratchpad'
const E2E_LOCK = `${SCRATCH}/e2e.lock`
const BASE = '4621d53'
const ALL_LANES = 'chat ids (PAR-7, PAR-52), share (PAR-13, PAR-31), purge (PAR-14), export (PAR-51), dev script (PAR-50)'

const LANES = [
  {
    key: 'chat-ids', port: 3171, items: ['PAR-52', 'PAR-7'],
    tests: 'apps/web-worker-tests/test/chat.test.ts, chat-api.test.ts, packages/db/test/messages.test.ts; browser tests for the Try again button',
    e2e: 'e2e/chat.spec.ts',
    focus: `Both items are about how chat.send and saveMessages (packages/db/src/queries/messages.ts) treat a message id they have seen before. Do PAR-52 first, then PAR-7.
PAR-52: the upsert's setWhere blocks an id owned by another draft, but nothing notices: the quota is spent and the message is missing. Prove it with a test (an id from draft A sent to draft B), then make it fail loudly with MESSAGE_ID_TAKEN and no quota spent.
PAR-7: "Try again" calls useChat regenerate(), which resends the last user message with the same id. Prove both failures with worker tests: (a) after a failed turn the model's history holds that user message twice, maybe with a partial reply between; (b) after a failed questionnaire-answer turn the retry loses the answers. Fix: a resent id that is the last user message of THIS draft is a retry: drop everything after it from the model's view and delete it from storage (no schema change, no migration). A failed answer turn retries by resending the answers. Decide how quota counts a retry by reading how it counts today; keep it unless that charges the user twice for one failed turn, and report the choice in ownerDecisions.
Attack angles for later: an id that is an older (not last) user message of this draft; retry while another turn is running; retry after a reload.`,
  },
  {
    key: 'share', port: 3172, items: ['PAR-13', 'PAR-31'],
    tests: 'apps/web-worker-tests/test/share.test.ts and observability.test.ts',
    e2e: 'e2e/share.spec.ts',
    focus: `Both items are about the public share link /s/:token (the token is a bearer secret).
PAR-13: share.view and the /s/* page have no rate limit (the per-user limit from T27 needs a user). Add a per-IP limit with the Cloudflare Rate Limiting binding (see ~/Projects/guides/ for its rules; period must be 10 or 60 s), keyed by the client IP, in wrangler config for every environment the app already defines (do not deploy). The /s/$token loader shows any 4xx as the friendly 404: a limited visitor must get its own message in the brand voice (work/PAR-1/brand.md), not "not found". Tests: over the limit gives the limit message; a different IP is not affected; a valid token still works under the limit.
PAR-31: Workers Logs attaches the full request URL (with the token) to every console line a request writes. Add a worker test that renders /s/:token for a hit, a miss, the rate-limited case and a thrown error, and fails if anything is written to the console. If the error path must log, log without the URL/token and make the test prove it. Your PAR-13 code must pass this test.
Attack angles for later: IP spoofing via headers other than CF-Connecting-IP; the RPC path vs the page path; any log line carrying the token.
Real-sandbox rule: the binding cannot be proven locally; list "verify the share limit on the Preview" in followUps.`,
  },
  {
    key: 'purge', port: 3173, items: ['PAR-14'],
    tests: 'packages/db/test/purge.test.ts, migrations.test.ts; apps/web-worker-tests/test/cron.test.ts',
    e2e: '',
    focus: `The nightly purge (T28) never removes expired \`verification\` rows or old \`rate_limit\` rows, and the queries behind them have no index. Prove each gap with a failing purge test, then: purge expired verification rows; purge rate_limit rows safely older than the longest Better Auth window in use (read the config; T27 has a 1-hour guest rule, so keep a clear margin); add indexes on rate_limit.last_request and session.expires_at with a new Drizzle migration (pnpm db:generate, then pnpm db:check). This lane is the ONLY one allowed to add a migration. Check with EXPLAIN on local Postgres that the purge queries use the new indexes and paste the plan lines in notes.
Attack angles for later: deleting a verification row that is still valid; deleting a rate_limit row inside its window; the migration on a database that already has data.`,
  },
  {
    key: 'export', port: 3174, items: ['PAR-51'],
    tests: 'apps/web-worker-tests/test/export.test.ts, packages/db/test/exports.test.ts',
    e2e: 'e2e/export.spec.ts',
    focus: `apps/web/src/server/rpc/export.ts (~372-390) builds the file from context.draft (read before the ~4 s print) but records the count against \`fresh\` inside the lock. If chooseDocument runs during the print, the user gets agreement A while B is counted. Prove it with a worker test that switches the agreement while the print is in flight, then make the file and the count always name the same agreement. Pick the smallest correct design (e.g. compare the agreement after the print and retry or refuse, or count what was printed) and do not hold a lock for the whole print unless you show it is safe; explain the choice in notes.
Attack angles for later: two exports at once; an edit (not a switch) during the print; the daily export limit at its last allowed export.`,
  },
  {
    key: 'dev', port: 3175, items: ['PAR-50'],
    tests: 'unit tests next to scripts/dev.ts and the vite config helper',
    e2e: '',
    focus: `From T40's review:
- apps/web/vite.config.ts signedInToCloudflare() misses ~/.wrangler and macOS (~/Library/Preferences/.wrangler). Use \`wrangler whoami --json\` with a short timeout, or check the same paths wrangler checks; pick one and say why.
- scripts/dev.ts: if db:dev exits after "ready", stop the app too (no app without a database); match "is ready" per line, not per chunk (buffer by line); Ctrl+C during startup must end cleanly with no unhandled rejection.
- Tests for the .dev.vars setup: a new secret is written, an existing file is untouched, and it fails loudly when BETTER_AUTH_SECRET= is empty.
Skip the optional CI step (CI changes need their own review). Prove each bug with a failing test first where it can be tested; make the process code testable by extracting pure parts.
Do NOT run \`pnpm dev\` against the shared Postgres in a way that stops it.`,
  },
]

const RULES = (l) => `
Hard rules:
- Your own fresh git worktree; never edit ${REPO} itself. Never push, merge, rebase or switch branches.
- Commits: \`<type>(<item id>): <why>\`, one item per commit, ending with the line: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Only items ${l.items.join(', ')}. Other lanes run at the same time: ${ALL_LANES}. Keep to the files your items need. Only the purge lane adds a migration. Do not run \`wi\` and do not edit work/PAR-1/.
- Local Postgres (db:dev, port 54320) is shared: never stop it. If it is down, start it detached (\`cd ${REPO} && nohup pnpm db:dev >/dev/null 2>&1 &\`) and leave it running. Port 3000 belongs to another app.
- e2e only under the lock: \`PORT=${l.port} flock ${E2E_LOCK} pnpm test:e2e --project=chromium --project=firefox <specs>\` from apps/web. Never leave a dev server running. Known flakes: \`wi show PAR-8\` (read only). The first \`pnpm test\` in a fresh worktree can fail from Vite "optimized dependencies changed"; run it again before believing a failure.
- Scripted AI only, no real model calls, no Resend sends. Never touch production or deploy; never delete cloud resources.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    lane: { type: 'string' }, worktreePath: { type: 'string' }, branch: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, done: { type: 'boolean' },
      proof: { type: 'string', description: 'the test that failed before the fix, and its failure message' },
      fix: { type: 'string' }, tests: { type: 'string' },
      commits: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
    }, required: ['id', 'done', 'proof', 'fix', 'tests', 'commits', 'notes'] } },
    skillsFollowed: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string', description: 'commands run and their result' },
    ownerDecisions: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['lane', 'worktreePath', 'branch', 'items', 'skillsFollowed', 'gates', 'ownerDecisions', 'followUps'],
}
const ATTACK_SCHEMA = {
  type: 'object',
  properties: {
    broken: { type: 'array', items: { type: 'object', properties: {
      item: { type: 'string' }, scenario: { type: 'string' }, evidence: { type: 'string', description: 'test output or exact reasoning' }, fix: { type: 'string' },
    }, required: ['item', 'scenario', 'evidence', 'fix'] } },
    held: { type: 'array', items: { type: 'string' }, description: 'attacks tried that the fix survived' },
  },
  required: ['broken', 'held'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
      item: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' }, issue: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'item', 'file', 'issue', 'fix'] } },
    doneWhenGaps: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
  required: ['findings', 'doneWhenGaps', 'verdict'],
}
const CLOSE_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, why: { type: 'string' } }, required: ['finding', 'why'] } },
    commits: { type: 'array', items: { type: 'string' } },
    gates: { type: 'string' }, followUps: { type: 'array', items: { type: 'string' } }, done: { type: 'boolean' },
  },
  required: ['fixed', 'skipped', 'commits', 'gates', 'followUps', 'done'],
}

const gate = (l) => `\`pnpm check\`, \`pnpm test\`, \`pnpm test:workers\`${l.e2e ? `, and e2e for ${l.e2e} (Chromium + Firefox, PORT=${l.port})` : ''}`

const results = await pipeline(
  LANES,

  (l) => agent(`Lane "${l.key}" of Parley wave 1: ${l.items.join(', ')}.

${l.focus}
${RULES(l)}
Steps:
1. Setup: if \`git rev-parse --short HEAD\` is not ${BASE}, \`git reset --hard ${BASE}\` (your own new branch, before any work). Copy ${REPO}/.env to the worktree root and ${REPO}/apps/web/.dev.vars to apps/web/.dev.vars (never commit them). \`pnpm install --frozen-lockfile\`.
2. Read \`wi show <id>\` for each item (its "Done when" is the bar). Load with the Skill tool and follow: agent-skills:test-driven-development (Prove-It pattern), agent-skills:git-workflow-and-versioning, plus any domain skill using-stack-skills routes this lane to (Cloudflare, Better Auth, Neon).
3. Prove each bug with a test that fails for the stated reason BEFORE you change the code; record the failure message. Then fix, see it pass, commit.
4. Gate once at the end: ${gate(l)}. Relevant tests: ${l.tests}.
Return the structured result. worktreePath = \`pwd\` at the worktree root; branch = \`git branch --show-current\`.`,
    { label: `build:${l.key}`, phase: 'Prove & fix', schema: BUILD_SCHEMA, isolation: 'worktree' }),

  (b, l) => b && parallel([
    () => agent(`Try to BREAK lane "${l.key}" of Parley wave 1 (${l.items.join(', ')}). Worktree ${b.worktreePath}, branch ${b.branch}. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`. Items: \`wi show <id>\` (read only).
The builder claims these bugs are fixed. Assume they are not. Find inputs, orders, races and paths where the original bug, or a new one the fix created, still happens. Start from these angles and add your own:
${l.focus.split('Attack angles for later:')[1] || '(none given)'}
You may write throwaway tests in the worktree and run them (worker and unit tests only, no e2e, no dev server), but at the end the worktree must be exactly as you found it (\`git status\` clean, no new commits). Report only what you showed with evidence; list what held.
Builder report: ${JSON.stringify(b)}`,
      { label: `break:${l.key}`, phase: 'Attack', schema: ATTACK_SCHEMA }),
    () => agent(`Review lane "${l.key}" of Parley wave 1 (${l.items.join(', ')}) before it merges. Worktree ${b.worktreePath}, branch ${b.branch}. Do not edit files and do not run tests. Diff: \`git -C ${b.worktreePath} diff ${BASE}...HEAD\`. Items: \`wi show <id>\`.
Load agent-skills:code-review-and-quality and follow it (five axes). Also check: each item's "Done when" is met (gaps in doneWhenGaps); the proof tests really fail without the fix (read them against the old code); nothing touches another lane's area; commit messages follow \`<type>(<item id>): <why>\`. Concrete findings only.
Builder report (verify, don't trust): ${JSON.stringify(b)}`,
      { label: `review:${l.key}`, phase: 'Attack', schema: REVIEW_SCHEMA, agentType: 'agent-skills:code-reviewer' }),
  ]).then(([a, r]) => ({ b, a, r })),

  (x, l) => {
    if (!x) return null
    const { b, a, r } = x
    const mustFix = (a?.broken.length || 0) + (r?.doneWhenGaps.length || 0) + (r?.findings.filter((f) => f.severity !== 'suggestion').length || 0)
    if (!a || !r) log(`${l.key}: ${!a ? 'breaker' : 'reviewer'} did not return; lane needs a manual check`)
    if (mustFix === 0) return { lane: l.key, build: b, attack: a, review: r, close: null }
    return agent(`Close lane "${l.key}" of Parley wave 1 (${l.items.join(', ')}). Worktree ${b.worktreePath} (branch ${b.branch}); cd there and edit only under that path.
${RULES(l)}
Fix every "broken" attack result (turn its scenario into a test that fails first), every doneWhenGap, and every critical/important finding. Suggestions only when clearly right and cheap; say why you skip any. Commit each fix. Then the gate once: ${gate(l)}.
Build report: ${JSON.stringify(b)}
Attack: ${JSON.stringify(a)}
Review: ${JSON.stringify(r)}`,
      { label: `close:${l.key}`, phase: 'Close', schema: CLOSE_SCHEMA })
      .then((c) => ({ lane: l.key, build: b, attack: a, review: r, close: c }))
  },
)

return results.map((x, i) => x || { lane: LANES[i].key, failed: true })