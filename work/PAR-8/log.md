### 2026-09-25T13:00:28Z
Created.

### 2026-09-25T19:12:13Z
More e2e tests that break on shared test data (wave B1): shell.spec 'the new draft is in the sidebar's history' and 'a draft can be started with the keyboard alone' depend on how many drafts the shared per-worker guest already has (T22's sidebar history adds tab stops and opens the sidebar). editing.spec 'a whole NDA...' needs test.slow() (31-42 s on a busy machine, limit 30 s). All pass alone. Also a real a11y gap: keyboard users tab through the whole history before the main content; add a 'Skip to content' link (T32 a11y pass).
