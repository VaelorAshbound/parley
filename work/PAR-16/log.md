### 2026-09-25T22:35:56Z
Created.

### 2026-09-29T21:47:45Z
Merged 02dd3d3: invocation_logs off in wrangler.jsonc (Cloudflare cannot redact a path), and server.ts overwrites url.full/url.path on the trace root span for /s/:token. Owner chose this trade-off: successful SSR requests get no automatic log line. Left: on a Preview, open /s/<token> and check (a) no invocation log, (b) the trace shows /s/:token. If the token still shows in the trace, the fallback is traces off or moving the token out of the path.

### 2026-09-29T21:47:45Z
phase: backlog -> verify
