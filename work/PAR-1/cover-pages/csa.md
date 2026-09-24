# CSA cover page (T8)

Definition: `packages/documents/src/definitions/csa.ts`. Rule tests: `packages/documents/test/csa.test.ts`.
Template: `templates/CSA.md`, **CSA v2.1** (spec §9). Written 2026-09-24.

## Sources checked

| What | URL |
|---|---|
| Official v2.1 cover page (Order Form + Key Terms) and its annotations. Scraped again on 2026-09-24 because the research report assumed v3. | https://commonpaper.com/standards/cloud-service-agreement/ |
| v2.1 Standard Terms (the URL the template cites in 13.31) | https://commonpaper.com/standards/cloud-service-agreement/2.1/ |
| Research report (v3-based, used for benchmarks and the Covered Claims text) | `work/PAR-1/cover-research/csa-sla-ai-addendum.md` |

## What the page holds

Two part headings, **Order Form** and **Key Terms**, as on the official page. Every official row is there, in the official order:

- **Order Form:** Cloud Service, Order Date, Pilot, Pilot Period Modifications, Subscription Period, Cloud Service Fees, Fee Changes, Payment Process, Auto-renewal, Use Limitations, Technical Support, SLA, Professional Services, Other Changes to Standard Terms.
- **Key Terms:** Effective Date, Governing Law, Chosen Courts, Covered Claims, General Cap Amount, Increased Claims, Increased Cap Amount, Unlimited Claims, Additional Warranties, DPA, Security Policy, Insurance Minimums, Additional Insured, Other Changes to Standard Terms.

All 22 linked terms map to a field. The coverage test passes.

## Judgment calls (for a lawyer to look at)

1. **Every official row, not only the linked ones.** Pilot, SLA, Professional Services, Security Policy and Insurance Minimums have no linked term in v2.1, but the brief says to add the rows the official page has. The research report had left them out; it was written for v3.
2. **"None" is an explicit option** on every optional row (Pilot, Use Limitations, Technical Support, SLA, Professional Services, both Covered Claims, Increased/Unlimited Claims, Increased Cap Amount, Additional Warranties, DPA, Security Policy, Insurance Minimums). Common Paper says "delete the row"; Parley prints "None" instead, which 13.1 reads the same way.
3. **Defaults only where Common Paper pre-marks "x":** Order Date and Effective Date = last signature; Auto-renewal = renews (days left empty); both Covered Claims = the committee text; General Cap Amount = a fees multiple (number left empty); Increased Claims = breach of §3 and §10; Increased Cap Amount = a fees multiple; Unlimited Claims = indemnification; Security Policy = commercially reasonable efforts. No benchmark defaults (no Delaware, no 12 months, no 30 days), because the brief allows only pre-marked ones.
4. **One signature block** at the end signs both parts. The official page has one under each part. The closing joins the two official closings: "Provider and Customer have not changed the Standard Terms except for the details in the Key Terms above. By signing this Cover Page, each party agrees to enter into the Framework Terms and this Order Form."
5. **Intro:** the official "Framework Terms" row and the "USING THE FRAMEWORK TERMS" text, word for word, with one fix: the official text says "Cloud Service Standard Terms"; we use the template's own name, "Cloud Service Agreement Standard Terms Version 2.1", and its URL. The official page has no "omitted term means none" sentence (it is in 13.1 of the terms), so the intro doesn't add one.
6. **Governing law allows non-US places** (`usOnly` off), because the terms never say "the State of" and the official blanks say "state, province, and/or country". Courts use `courts: "anywhere"`, as the brief asks for a stand-alone "Chosen Courts".
7. **Chosen Courts wording:** the field prints "courts located in …", so the row reads "The courts located in {place} (whether state, federal, or otherwise)". Official: "The courts (whether state, federal, or otherwise) located in …". Same meaning, words moved.
8. **Fee multiples:** General Cap Amount takes any multiple above 0 (a $0 cap is unenforceable, official note). Increased Cap Amount must be above 1x ("a number other than 1").
9. **Rules.** They run on drafts, and each change is checked on its own, so each draft rule blocks only a contradiction, never a missing value. The rows can be filled in any order. Rules that need a value run only on the finished page (see 13).
   - Provider and customer must be different companies.
   - Fee Changes: "may increase" and "will increase" can't both be picked.
   - Increased Claims (anything but None) can't have Increased Cap Amount = None, or those claims would have no cap at all (8.1(b)).
   - One claim can't be both an Increased Claim and an Unlimited Claim (8.4 would cap it and uncap it at once). Indemnification is pre-marked as Unlimited, so moving it to Increased means unticking it there first; the message says which claim.
   - When both caps are fee multiples, the increased one must be higher. Other shapes (a fixed amount, "the greater of") are not compared.
10. **Details that belong to a picked option are blanks inside it**, so they are required once it is picked: the pilot's length and fee (a paid/free pick inside the pilot sentence), the certifications list, and the insurance minimums. They print on the option's line ("…with the following: SOC 2 Type II; Penetration testing") instead of as their own checkboxes. The official page shows them as nested checkboxes.
11. **The price is its own row.** "Cloud Service Fees" holds the price (per unit, or another structure; at least one is required). The renewal increases and "inclusive of taxes" boxes are a separate optional row, **Fee Changes** (Parley heading), so a finished page always has a price and the boxes can be ticked in any order.
12. **Parley headings** (no official heading exists): "Pilot Period Modifications", "Fee Changes", "Additional Insured". The official page nests these inside the row above. The group labels "Subscription details", "Additions and Modifications" and "Attachments, Supplements & Modifications" are dropped: the engine has one heading level, used for the two parts.
13. **Professional Services:** the official cooperation paragraph comes after the options. Hints print before them, so it is the hint, with "described above" changed to "described below". It prints even when None is picked. "Payment Process for these services" needs a service named (by SOW/PSA or described) on the finished page; a draft can tick the boxes in any order.
14. **Other lines print last** (the engine always puts them last). In the certifications list the official Other comes after HITRUST.
15. **Additional Insured stays optional:** it is a real "pick none or more" row. It shows only when insurance is required, with the official certificate paragraph as its hint.

## Engine gaps (fixed after T8)

The engine gained these after T8, and this definition now uses them:

1. **Any definition is a `DocumentDefinition`**, so the registry type-checks and the test loops need no cast (`allDefinitions` is gone).
2. **`field.select` works as a blank.** "How often" and "Counted from" are selects now. The printed words are the same.
3. **Rules know the phase.** A rule can require a value only on the finished page. Used for the services payment (call 13). The nested blanks of call 10 stay: they print well and need no rule.

Still open: **no fixed text after a row's options** (call 13), and **part headings don't print a hint** (the official "The key business terms of this Order Form are as follows:" is dropped).
