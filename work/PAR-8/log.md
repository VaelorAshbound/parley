### 2026-09-25T13:00:28Z
Created.

### 2026-09-25T19:12:13Z
More e2e tests that break on shared test data (wave B1): shell.spec 'the new draft is in the sidebar's history' and 'a draft can be started with the keyboard alone' depend on how many drafts the shared per-worker guest already has (T22's sidebar history adds tab stops and opens the sidebar). editing.spec 'a whole NDA...' needs test.slow() (31-42 s on a busy machine, limit 30 s). All pass alone. Also a real a11y gap: keyboard users tab through the whole history before the main content; add a 'Skip to content' link (T32 a11y pass).

### 2026-09-25T22:36:00Z
Wave B2 saw two more cold-dev-server timeouts (30 s): export.spec 'a guest who wants the PDF' (23 s alone, times out next to share.spec) and drafts.spec 'a signed-out visitor keeps the browser's own Ctrl+K' in Chromium (passes 6/6 alone). Same kind of problem: the first compile of a route eats the test's time.

### 2026-09-26T02:44:15Z
2026-09-26 after wave B2: drafts.spec 'renames a draft' and editing.spec 'a whole NDA' fail about half the time locally in Chromium, even alone (repeat-each=3). Same rate on the pre-wave commit 630a811 (3/6), so not a B2 regression. Trace: on a cold dev server the draft page stays on its skeleton; some module requests (chat-panel.tsx, field-editor.tsx, download.tsx, definitions/psa.ts, sla.ts) end with status -1, and the page never finishes loading. Later repeats pass. Also: a memory-killed e2e run left 12 orphaned workerd processes (2.7 GB) behind; they made a full run fail 10 tests until killed.

### 2026-09-27T17:49:21Z
2026-09-27 (T37 merge): limits.spec 'a guest with a draft is asked to make an account for a second' fails in Firefox 3/3 with NS_BINDING_ABORTED on the second page.goto('/') from the draft page. Same 2/2 on the pre-T37 commit b7def71, so not T37. Same symptom as shell.spec:120.

### 2026-09-27T20:20:16Z
More flaky tests seen in CI on 2026-09-27 (PAR-1-parley): (1) e2e drafts.spec 'a signed-out visitor keeps the browser's own Ctrl+K' failed first and passed on retry twice (runs for a510dd0/1dd6594 era and 417b24b; once a page.evaluate timeout at 30 s). (2) Component test src/features/drafts/search-dialog.browser.test.tsx 'arrow keys move the highlight, and Enter opens that draft' failed on 1dd6594 (expected '/d/d1' to be '/d/d2'), passed on the next run. (3) e2e drafts.spec 'renames a draft from its title menu, everywhere at once' passed only on retry on 417b24b. None touched by recent tasks.
