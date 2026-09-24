# Partnership Agreement: cover page notes (T10)

Definition: `packages/documents/src/definitions/partnership-agreement.ts`. Standard Terms: Version 1.0, as the template cites in 13.19.

## Version mismatch (for the owner)

`templates/Partnership-Agreement.md` says **Version 1.0** in 13.19 (with the 1.0 URL), but its text already has the two **1.1** fixes ([version history](https://commonpaper.com/standards/partnership-agreement/versions)):

- 6.5 reads "Section 9 (Limitation of Liability)"; hosted 1.0 reads "Limitation not Liability".
- 11.3 reads "the Discloser"; hosted 1.0 reads "Disclosing Party".

The cover page cites what the template itself states: **Version 1.0** and https://commonpaper.com/standards/partnership-agreement/1.0, so the page and 13.19 agree. The official 1.0 and 1.1 cover pages are the same row for row (compared on 2026-09-24), so nothing else changes. A later task could swap the template for the hosted 1.1 text and bump both citations to 1.1.

## Sources checked

- Official Cover Page 1.0 (DOCX): https://commonpaper.com/standards/partnership-agreement/1.0/cover-page-docx
- Cover page 1.1 preview and annotations: https://commonpaper.com/standards/partnership-agreement/
- Standard Terms: https://commonpaper.com/standards/partnership-agreement/1.0 and https://commonpaper.com/standards/partnership-agreement/1.1
- Versions: https://commonpaper.com/standards/partnership-agreement/versions
- Research report: `work/PAR-1/cover-research/pilot-design-partner-partnership.md` §3.

The rows, hints, option wording and closing were compared line by line with the 1.0 DOCX scrape.

## What the page holds (official order)

Business Terms (part) → Obligations (Company will) · Obligations (Partner will) · Territory · Payment Process · Payment Schedule · End Date → Key Terms (part) → Effective Date · Governing Law · Chosen Courts · Covered Claims · General Cap Amount · Increased Claims · Increased Cap Amount · Unlimited Claims · Additional Warranties → Attachments and Supplements (part) → DPA · Brand Guidelines → Changes to Standard Terms (part) → Changes to Standard Terms → closing → Company | Partner signatures.

## Judgment calls

1. **Explicit "None" on every optional checklist.** Obligations (each party), Payment Process, Increased Claims, Unlimited Claims, Additional Warranties and Brand Guidelines are multi-selects with a "None" that can't be picked with anything else. Covered Claims (each party), Payment Schedule and Increased Cap Amount are single choices with "None". The official page says "delete this entire row" instead; the brief asks for "None is an answer", so an empty row is never a silent choice. "None" is a Parley addition.
2. **General Cap Amount is required, with no default.** The official page makes it optional, and an empty cap means "the Agreement will not have a limitation of liability".
3. **Covered Claims have no default.** Common Paper leaves both boxes unchecked, with the Committee's wording in brackets. Parley offers that wording as one option, a custom claim as another, and None. (The research proposed pre-picking the Committee wording for both; the brief allows defaults only where Common Paper pre-marks one.) They print as labeled lines, "Company Covered Claim(s): …", like the official page.
4. **Rules.** The ones that tie two fields together run only on a complete document (the "complete" phase), so a draft can change the fields one at a time. Before, they ran on drafts, and Increased Claims and Increased Cap could deadlock: from None/None, neither could change first. Only "a number other than 1" still checks drafts, since it reads one field.
   - at least one Obligation across both parties (official: "Choose at least one");
   - an Obligation that is a payment needs a Payment Schedule (official: "this Variable is required"), so "None" is refused then;
   - with no payment Obligation, a "[#] times the fees" General or Increased Cap is $0 and is flagged (Common Paper: "a $0 liability cap would be unenforceable"); "the greater of $X or …" stays allowed;
   - the Increased Cap multiple can't be 1 (official: "a number other than 1");
   - Increased Claims and Increased Cap Amount move together: None with None, claims with a cap. This makes the cap required whenever there are Increased Claims, which 9.1(b) needs.
5. **Not added:** a rule against the same claim in both Increased and Unlimited Claims. Section 9.3 settles it (Unlimited wins), so it is redundant, not a conflict.
6. **Defaults** follow the official "[ x ]" marks only: Territory "Worldwide", End Date "[#] after the Effective Date" (length left blank), Effective Date "Date of last signature on this Cover Page".
7. **End Date custom** is free text, so "Until terminated by either party" (Common Paper's own suggestion) fits. The help says there is no termination for convenience (6.2).
8. **Payment amounts** are free text inside the payment Obligation, so the user writes the currency; 2.1(a) defaults Fees to U.S. Dollars "unless the Cover Page specifies a different currency".
9. **Governing law** takes a US state or a province/country (official: "[state and/or country]"); courts are named in full.
10. **DPA** keeps the official hint "Data Protection Agreement", although Common Paper's own DPA is a "Data Processing Agreement". It is optional free text; empty means none (13.1).
11. **Company and Partner**: either side may be "Company" (Common Paper's note); the help says so plainly.

## Deviations from the official wording

- **Brand Guidelines** lines add a colon: "Company Brand Guidelines: [where to find]". The official line has no colon before the bracket.
- **Chosen Courts** prints "The courts located in [place]", without the official "(whether state, federal, or otherwise)". The jurisdiction field prints "courts located in …" itself. Meaning is the same.
- **Covered Claims** custom option keeps the official lead-in and replaces only the bracketed text, as the official bracket invites.
- **Quotes**: the official 1.0 DOCX mixes straight and curly apostrophes ("a party's", "Party’s"); Parley uses the curly one throughout.
- **Signature rows** keep the NDA's rows, including "Company"; the official table puts the company in the column header.
- **Footer**: the brief's two lines, naming "Common Paper Partnership Standard Terms (Version 1.0)". The official 1.0 DOCX has no attribution line; the 1.1 page's line wrongly says "Cloud Service Agreement".

## Engine gaps

No `field.select` change here: every pick on this page is a checkbox, a radio or free text, so no small choice stood in for a pick list.

1. **Fixed: "required when".** Rules know their phase now (8b78a29). The consistency rules in 4 run on the complete document only. The explicit None options stay: None is a real answer on Common Paper's pages.
2. **A section holds one field**, so the official Obligations row becomes two "Obligations" rows (hints "Company will:" / "Partner will:").
3. **Fixed: part headings print their hint** in the outputs.
4. **Choices print "None" above "Other"**, because Other is always the last line.
5. **Notice Address** is not linked in this template (12.7), so no term maps to `.notice`; the signature table still prints each party's notice address.
