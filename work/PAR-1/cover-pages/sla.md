# SLA cover page (T8)

Definition: `packages/documents/src/definitions/sla.ts`. Rule and layout tests: `packages/documents/test/sla.test.ts`.
Template: `templates/sla.md`, **SLA v2.0**. Written 2026-09-24.

## Sources checked

| What | URL |
|---|---|
| Official SLA cover page and its annotations (scraped again on 2026-09-24) | https://commonpaper.com/standards/service-level-agreement/ |
| SLA 2.0 Standard Terms (the URL the template cites in 4.6) | https://commonpaper.com/standards/service-level-agreement/2.0/ |
| Research report | `work/PAR-1/cover-research/csa-sla-ai-addendum.md` |

## What the page holds

Agreement, one **SLA** row with the two official target boxes (Target Uptime with its Scheduled Downtime; Target Response Time with its credit sentence and Support Channel), the Uptime Credit table, and the two signature blocks. All 9 linked terms map to a field.

## Judgment calls (for a lawyer to look at)

1. **A stand-alone page.** Common Paper prints the SLA as a block inside the CSA Order Form. Parley ships it as its own document, so it needs an **Agreement** row (the Order Form it joins) and its own signatures. The intro is Parley's, modeled on the official one ("This Order Form incorporates the Service Level Agreement Standard Terms available at … with the below Variables. A copy of the SLA Standard Terms is attached for convenience only.") and on the AI Addendum's ("amends and is incorporated into the following Agreement", "undefined capitalized words", "will control"). It adds "this Cover Page will control" over the SLA Standard Terms, as the brief asks. The closing, "By signing this Cover Page, each party agrees to enter into this SLA.", follows the AI Addendum's.
2. **"Subscription Period" reads the Agreement row.** The SLA's terms use the Order Form's Subscription Period (1.2, 3.3, 3.4). A second duration field here could contradict the CSA, so the linked term points at the Agreement description instead of a new field.
3. **The two targets are one multi-select**, like the official page's two "[ ]" boxes, under the official heading "SLA" / "Service Level Agreement". A finished page needs at least one target: with neither, the SLA promises nothing. That check runs only on a finished page, so a draft can switch targets in any order (tested).
4. **Each target's details are blanks inside its line,** so they are required once the target is picked: the uptime percent and the Scheduled Downtime choice; the response time, the credit and the Support Channel. Without a Support Channel, 2.1 covers no request at all, so it must not be left empty. The words are the official ones, joined on one line: "Target Uptime: {x}. Scheduled Downtime means time periods where the Cloud Service is not available to Customer: {…}" and "Target Response Time: {x}. The Response Time Credit will be {y} of the monthly Cloud Service Fee for each time Provider fails to meet the Target Response Time. Support Channel: {z}". The linked terms Target Uptime, Scheduled Downtime, Target Response Time, Response Time Credit and Support Channel all read this row.
5. **Scheduled Downtime has an explicit "None"** (brief: None is an answer). "None" means no downtime is excused, which favors the customer.
6. **Uptime Credit is a table** (`field.list`, up to 10 rows) under the targets, shown only with an uptime target. Its column names are the official headers, kept in their Title Case (they print as the table header), not sentence case. The range is free text ("99.0% to Target Uptime"), because the official rows mix shapes ("to Target Uptime", "x% to y%", "under x%"); nothing checks that bands don't overlap. Common Paper says the table "can be customized, including adding or deleting rows". No default rows: Common Paper leaves every number blank.
7. **Target Uptime allows 3 decimals** (99.999%, Common Paper's "strong" example). **Target Response Time** uses minutes, hours or days; the downtime notice uses hours or days, as on the official page.
8. **No defaults.** Common Paper pre-marks no option on the SLA block. The research report's credit numbers (5/10/20%, 2%) are only in the test example, not seeded.
9. **The 8% cap** in 3.3 caps the total credits per Subscription Period, so higher tiers in the table are still valid. No rule checks the table against it.
10. **"Description of Agreement"** keeps the capital A: "Agreement" is a defined term.

## Engine gaps

1. **An empty Uptime Credit table is accepted.** A table can't be a blank inside an option, and rules run on drafts, so nothing can say "required when an uptime target is picked". A finished page with an uptime target and no rows prints one row of placeholders and gives no credit. Needs a "required when" feature, or a placeholder check before export (for the lead to file).
2. Same registry typing gap as the CSA (see `csa.md`); the looping tests use `allDefinitions`.
