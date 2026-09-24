# BAA: cover page notes (T9)

Definition: `packages/documents/src/definitions/baa.ts`. It mirrors Common Paper's
official BAA 1.0 cover page, row by row and in the same order.

## Sources checked

- Official BAA 1.0 cover page (DOCX, scraped again on 2026-09-24):
  https://commonpaper.com/standards/business-associate-agreement/1.0/cover-page-docx
- Landing page, FAQ and the configuration variables:
  https://commonpaper.com/standards/business-associate-agreement/
- BAA 1.0 Standard Terms (`templates/BAA.md`; definition 6.3 names 1.0 and its URL).
- HIPAA 45 CFR §164.410(b), the 60-calendar-day limit:
  https://www.law.cornell.edu/cfr/text/45/164.410
- Research report: `work/PAR-1/cover-research/dpa-baa.md`.

## What the cover page holds

- **Key Terms:** Agreement, Relationship, Breach Notification Period,
  Designated Record Set, Limitations (Subcontracting, Offshoring,
  De-identification, Aggregation), BAA Effective Date.
- **Changes to BAA Standard Terms:** Other Changes to BAA Standard Terms.
- The closing line, both signature blocks, and the footer.

## Required or optional (6.1: a blank switches its clause off)

Required:

- **Agreement:** 5.1 and 5.2 tie the BAA to it.
- **Breach Notification Period:** a blank switches off 4.1. A BAA without
  breach reporting fails 45 CFR §164.504(e)(2)(ii)(C).
- **BAA Effective Date:** a blank leaves 5.1 with no start. Common Paper
  pre-marks "Date of last signature", so that is the default.
- **Relationship (both lines):** each party's role under HIPAA.
- **Designated Record Set:** it decides whether the access and amendment
  duties in 1.10 apply.
- **The four Limitations:** each has an explicit "No limitation" option (see
  deviations).

Optional: **Other Changes** (free text; blank means none).

## Breach Notification Period cap

- Units: hours, business days and calendar days only, as on the official page.
- The rule caps it at 60 calendar days: 60 calendar days, or 38 business days.
  A computed check over 2024–2034 with US federal holidays shows that 38
  business days never run past 60 calendar days. 40 business days can reach 62.
- The rule also allows up to 1,440 hours, but the engine stops every duration
  at 999, so 999 hours (about 42 days) is the real limit.
- **No default.** Common Paper gives none. The research suggested 5 business
  days as market practice. That call is for the user or the AI, not a default.

## Judgment calls (a lawyer should look)

1. **Relationship keeps the official two pickers**, so a user can pick
   "Provider is a subcontractor" with "Company is a Covered Entity". Under
   HIPAA, a subcontractor works for a Business Associate, not straight for a
   Covered Entity. There's no rule against this pair, because a draft rule
   would block changing the two fields one at a time (engine gap 2 in
   `dpa.md`). The AI should warn about it.
2. **Designated Record Set has no default.** Common Paper says "select one and
   delete the other". The right answer depends on the product.
3. **Limitations default to nothing.** The user must pick for each of the four.
   "No limitation" matches the Standard Terms, which favor Provider. Covered
   entities often limit offshoring and aggregation.
4. **Aggregation "for its own purposes" (3.3)** is wider than HIPAA data
   aggregation for the covered entity's health care operations
   (§164.504(e)(2)(i)(B)).

## Deviations from the official page

- **"No limitation" options.** On the official page you delete a Limitations
  row to allow the activity. Parley shows "No limitation. Section 1.7 [3.1,
  3.2, 3.3] of the BAA Standard Terms applies." so the answer is visible
  (brief: "None is an answer").
- **Nested checkboxes.** The official "unless:" checkboxes under Subcontracting
  and De-identification are a nested multi-select inside the "unless" option.
  Both conditions can be ticked, as on the official page. They print on one
  line, joined by "; ".
- **Relationship:** each option holds the whole sentence ("Provider is a
  subcontractor"). The engine won't put a template on a choice's row.
- **Drafting notes become hints:**
  - Breach Notification Period: "This time period cannot be more than 60
    calendar days."
  - Limitations: the first sentence of the note.
  - The official hints ("The date the BAA starts", "Additional modifications or
    customizations") are kept word for word.
- **Signature rows** are the default ones (Signature, Print Name, Title,
  Company, Notice Address, Date). The official table has the same rows, with
  the company name in its header.
- **The omitted-term rule** isn't in the intro, because the official BAA intro
  doesn't have it. It lives in Standard Terms 6.1.

## Engine gaps

- **`units` narrows a duration's schema but not its TypeScript type.** So the
  limit table lists every unit (each entry is the most that stays within 60
  calendar days). The field's schema still rejects the other units.
- **No "required when"**, and the Relationship pair can't be checked with a
  draft rule. Both are described in `dpa.md`, gaps 2 and 4.
