---
id: PAR-43
title: Polar customer_session_token stays in the URL and history after checkout
phase: done
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T21:59:25Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Polar's customer_session_token stays in the address bar and history after checkout
(QA area: account-memory)

- Steps: 1) Upgrade to Pro through the Polar sandbox checkout. 2) Look at the URL after the return to Parley.
- Expected: Remove checkout_id/customer_session_token from the URL once the success banner is shown (history.replaceState), so the portal token isn't kept in history or shared by copy-paste.
- Actual: The URL stays as /pricing?checkout_id=…&customer_session_token=polar_cst_… . The response has no Referrer-Policy header (curl -sI /pricing), so only the browser default protects it from leaking through Referer.
- Evidence: The URL after checkout: https://par-1-parley-parley.vaelorashbound.workers.dev/pricing?checkout_id=1ff052dc-…&customer_session_token=polar_cst_iS4I… ; screenshot qa/account-memory/22-after-checkout.png. The security headers are already planned in T38.
- Likely file: apps/web/src/routes/_app/pricing (success banner) and the checkout successUrl in the billing plugin

Done when: the token is removed from the URL after the success banner reads it (history.replaceState), and Referrer-Policy is set (T38 headers).
