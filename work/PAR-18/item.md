---
id: PAR-18
title: "Polar: daily reconcile of Pro users + alert on polar_state_failed (before T38)"
phase: cancelled
priority: high
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-30T21:00:33Z
---

Checkpoint 6 review (billing, Required #2). If webhooks keep failing (expired POLAR_ACCESS_TOKEN, a unique violation), every delivery answers 500, Polar gives up on the endpoint (it already happened once), and no revoke ever arrives: anyone who cancels keeps Pro forever, silently.

- Alert on `polar_state_failed` (load observability-and-instrumentation first).
- A daily step in the T28 cron: for `plan = 'pro'` users with an old `planUpdatedAt`, call `applyCustomerState` again with the stored `polarCustomerId` (a few Polar calls a day).
- Must land before T38 turns on production billing.
