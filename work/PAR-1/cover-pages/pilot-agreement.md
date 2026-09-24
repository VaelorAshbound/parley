# Pilot Agreement: cover page notes (T10)

Definition: `packages/documents/src/definitions/pilot-agreement.ts`. Standard Terms: Version 1.1, as the template cites in 8.17.

## Sources checked

- Official Order Form 1.1 (DOCX): https://commonpaper.com/standards/pilot-agreement/1.1/cover-page-docx
- The same form as a Google Doc: https://docs.google.com/document/d/1Dx2SEXT32zWBK-cB1qFx3x2hmfy5G52gk0YPJLHRWo4/edit
- Standard Terms 1.1: https://commonpaper.com/standards/pilot-agreement/1.1
- Landing page: https://commonpaper.com/standards/pilot-agreement/
- Research report: `work/PAR-1/cover-research/pilot-design-partner-partnership.md` §1 (scrapes of 2026-09-24).

The rows, hints, option wording, closing line and signature rows below were compared line by line with the DOCX scrape.

## What the page holds (official order)

Order Form (part) → Product · Effective Date · Pilot Period · Fees · Payment Process (paid pilots only) · Governing Law · Chosen Courts · General Cap Amount → Attachments, Supplements & Modifications (part) → DPA · Technical Support · Other Changes to Standard Terms → closing → Provider | Customer signatures.

## Judgment calls

1. **Title "Pilot Agreement Order Form".** The official page is headed "ORDER FORM" over "Pilot Agreement", and the Standard Terms say "Order Form" 25+ times. Parley's eyebrow slot holds the "Cover page by Parley" label, so the two official lines are joined into one title.
2. **General Cap Amount is required, with no default.** The official page pre-marks "[N]x the Fees", but an empty cap means "the contract will not have any limitation of liability" (official drafting note). Nobody should get that by skipping a field.
3. **Rule: a free pilot can't use "[N]x the Fees".** With no Fees that cap is $0, which Common Paper itself calls unenforceable. "The greater of $X or Nx" stays allowed: it is at least $X.
4. **Rule: the greater-of multiple can't be 1.** The official blank says "fill in a number other than 1". `field.number` can't express "not 1", so a rule does.
5. **Multiples** are numbers above 0 with up to 2 decimals (1.5x is common), at most 100.
6. **Fees has no default.** The official page marks neither "Free Pilot" nor paid. (The research proposed "Free Pilot"; the brief allows defaults only where Common Paper pre-marks one.)
7. **Pilot Period has no default.** "e.g. 3 months" is an example, not a pre-mark. The help text keeps the example.
8. **Payment Process** is a single choice (the drafting note says "select one option and delete the other"), shown only when Fees is paid ("If a free Pilot, delete this row entirely"). It is optional, see engine gap 1.
9. **Product** (8.14) and **Fees** (8.10) are not linked terms, but the terms get their meaning from the Order Form, so both are required rows.
10. **DPA, Technical Support, Other Changes** are optional free text: empty means none (8.1).
11. **Governing law** takes a US state or a province/country ("state, province, and/or country" on the official page), and the courts are named in full (`courts: "anywhere"`).
12. **Fixed cap currency.** The official blank is "$[dollar amount]". The money field lets the user pick another currency; it prints with its symbol, so the page stays clear.

## Deviations from the official wording

- **Payment Process options** join the official sub-heading and sentence on one line: "Pay by invoice: Customer will pay Fees…" and "Automatic payment: Customer authorizes…". The official page prints them on two lines.
- **Chosen Courts** prints "The courts located in [place]". The official line is "The courts (whether state, federal, or otherwise) located in [place]". The jurisdiction field prints "courts located in …" itself, so the parenthesis can't sit between "courts" and "located" without an engine change. Meaning is the same: all courts in that place.
- **Intro** says "Standard Terms Version 1.1" (the template's own name) where the official intro says "v1.1", and its link text is the full URL, as on the official page.
- **Signature rows** keep the NDA's rows, including "Company". The official table puts the company in the column header ("PROVIDER: [official company name]"), which Parley's signature table doesn't have.
- **Footer**: the official line is "Common Paper Pilot Agreement (Version 1.1) free to use under CC BY 4.0." The brief's form names the Standard Terms: "Common Paper Pilot Agreement Standard Terms (Version 1.1)…", plus the Parley adaptation line.
- **Hints**: only the official ones are used (Effective Date, Chosen Courts, General Cap Amount, DPA, Other Changes, and the "Order Form" part lead-in).

## Engine gaps

1. **No "required when".** Rules run on drafts, and a rule issue rejects the change, so "Payment Process is required when Fees is paid" would block picking "paid" before the payment process. Payment Process is optional for now. Suggested fix: rules that run only on the complete schema.
2. **`field.select` can't be a blank.** Its `options` (a record of strings) clash with `AnyField.options` (a record of option objects), so it fails to type-check inside `blanks`. The billing cadence and "counted from" blanks use a small `field.choice` instead (stored as `{ option: "monthly" }`).
3. **Part headings drop their hint** in the HTML and DOCX output, so the lead-in "The key business and legal terms of this Agreement are as follows:" is stored but not printed.
4. **No typed "any definition".** `DocumentDefinition<Fields>` has no party keys, so no real definition is assignable to it. The three test loops over `definitions` widen with `as unknown as` (commented). The app will need the same once it looks up a definition by id.
