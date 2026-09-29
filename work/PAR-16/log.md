### 2026-09-25T22:35:56Z
Created.

### 2026-09-29T21:47:45Z
Merged 02dd3d3: invocation_logs off in wrangler.jsonc (Cloudflare cannot redact a path), and server.ts overwrites url.full/url.path on the trace root span for /s/:token. Owner chose this trade-off: successful SSR requests get no automatic log line. Left: on a Preview, open /s/<token> and check (a) no invocation log, (b) the trace shows /s/:token. If the token still shows in the trace, the fallback is traces off or moving the token out of the path.

### 2026-09-29T21:47:45Z
phase: backlog -> verify

### 2026-09-29T21:52:07Z
Verified on the Preview (6f20d18), probe /s/par16probe…x7q x3 at 21:50:58Z. Workers Observability: no invocation logs (only spans + our own console lines); the 4 /s/ trace spans show url.path=/s/:token and url.full=…/s/:token; a needle search for the probe token finds nothing. Residual: our own console lines carry $workers.event.request.url (full URL), so any log or error written during an /s/:token request would hold the token. None today (SSR /s/ logs nothing); filed as a follow-up.

### 2026-09-29T21:52:07Z
phase: verify -> done
