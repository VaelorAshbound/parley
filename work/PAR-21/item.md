---
id: PAR-21
title: Billing polish from the Checkpoint 6 review
phase: backlog
priority: low
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-28T17:21:40Z
---

- Log a warning when a customer.state_changed payload fails parsing (today: 200 and no trace); consider external_id nullish.
- Email change doesn't reach Polar: customers.updateExternal on email change when polarCustomerId is set (ties to PAR-17).
- A Free user who paid before can't reach past invoices: account menu offers only Upgrade.
- Portal answers 500 when the Polar customer was deleted by hand: map to NO_BILLING.
- makeCustomer warns on every second checkout: skip the log for 409/422.
