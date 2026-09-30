### 2026-09-29T21:46:59Z
Created.

### 2026-09-30T16:00:46Z
Fixed in the T36 wave, merged e321a6f. Root cause: the phone drawer's state outlives navigation inside the _app layout. Fix: one click handler on the sidebar (display: contents wrapper) closes the drawer for any link, including the account menu's Settings and Upgrade to Pro (review found those) and PAR-12's history links (their own handlers removed). Browser tests render the real AccountMenu; vite.config keeps @tanstack/react-start out of browser pre-bundling so the session module can be mocked. Gate: check pass, test 103/103, e2e phone.spec on chromium-phone + firefox-phone pass.

### 2026-09-30T16:00:55Z
phase: backlog -> done
