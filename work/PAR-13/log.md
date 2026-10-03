### 2026-09-25T22:35:56Z
Created.

### 2026-10-03T07:17:52Z
Wave 1 (fix/wave-1): SHARE_RATE_LIMITER 30/60 s per IP (IPv6 by /64), own 429 page with Retry-After. Owner OK with 30/60 s. Open: verify the real binding on a Preview.

### 2026-10-03T07:50:20Z
Verified on production 2026-10-03: a 100-request burst got 76 x 429 with Retry-After: 60; the browser shows 'Give it a minute'. Sequential requests (35 in ~10 s) were not limited: the Cloudflare binding counts per location and loosely, as documented.

### 2026-10-03T07:50:20Z
phase: backlog -> done
