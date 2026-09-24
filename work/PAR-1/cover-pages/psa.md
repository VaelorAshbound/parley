# PSA cover page (T11)

Definition: `packages/documents/src/definitions/psa.ts`. Example: `psa` in
`packages/documents/test/examples.ts`. Rules and defaults: `test/psa.test.ts`.

## Sources checked

- Official cover page (SOW + Key Terms), re-scraped 2026-09-24:
  https://commonpaper.com/standards/professional-services-agreement/
- Version history (1.1 only renames "Disclosing Party" to "Discloser" in §11.3,
  which `templates/psa.md` has, so the template is 1.1):
  https://commonpaper.com/standards/professional-services-agreement/versions
- Help Center and research: `work/PAR-1/cover-research/psa-software-license.md`.
- The template `templates/psa.md` and its outline `test/__outlines__/psa.txt`
  (27 linked terms, all mapped).

## What the page holds

Title, subtitle "USING THIS AGREEMENT", then two parts in the official order:

- **SOW:** Services, Deliverables, Drafts and Acceptance, Rejection Period,
  Resubmission Period, Time of Assignment, Third-Party Materials, Fees (with
  travel and expenses), Payment Period, Invoice Period, SOW Date, SOW Term,
  Customer Obligations, Other Changes (this SOW only).
- **Key Terms:** Effective Date, Governing Law, Chosen Courts, Covered Claims,
  General Cap Amount, Increased Claims, Increased Cap Amount, Unlimited Claims,
  Additional Warranties, Insurance Minimums (Provider, Customer), DPA, Customer
  Policies, Security Policy, Security Certifications, Publicity Rights, Other
  Changes (Agreement and all SOWs).

One closing and one signature table cover both parts.

## Judgment calls (a lawyer should look at these)

1. **Intro carries the omitted-term rule.** The PSA Standard Terms don't say
   what an empty variable means; only Common Paper's cover page does. The
   intro is the official "USING THIS AGREEMENT" paragraph word for word
   (Version 1.1 and its URL), so it incorporates the terms, says the Cover
   Page controls, and states the "none / not applicable" rule. The official
   "SOW and Agreement" sentence follows it, without the `[XX]` SOW number
   (Parley drafts one SOW).
2. **One signature for the SOW and the Key Terms.** Common Paper signs them
   apart. The closing joins the two official closings: "…enter into this
   Agreement as of the Effective Date and into this SOW as of the SOW Date."
3. **Deliverables is a choice with "This SOW has no Deliverables."** The
   terms say "Deliverables (if any)", so none is a real answer and must be
   said out loud (brief rule). "Drafts and Acceptance" only shows when there
   are Deliverables; the two periods only show when acceptance applies.
4. **Time of Assignment is required**, even when there are no Deliverables.
   Left empty, §2.1 would never pass ownership to Customer. The engine can't
   require it only when Deliverables exist, so it is always asked; with no
   Deliverables it simply has no effect.
5. **Third-Party Materials:** the official radio plus two checkboxes became
   five radio options built only from official sentences. Required, since
   "No Third-Party Materials…" is an explicit answer.
6. **General Cap Amount is required** (empty = unlimited liability). The
   multiple must be more than 0, and an Increased Cap multiple more than 1
   (official "a number other than 1"; a supercap below 1x makes no sense).
7. **Governing law is worldwide** (`courts: "anywhere"`): the terms say "the
   Governing Law", not "the State of", and the official page allows a state
   and/or country.
8. **Defaults only where the official page marks `x`:** SOW Date and Effective
   Date = last signature, SOW Term = fixed length (number left empty), both
   Covered Claims = the standard text, General Cap = multiple (number left
   empty). Help Center defaults (1x cap, 5x supercap, 30 days) are not seeded.
9. **Covered Claims** are choices: the official text, your own text after the
   fixed "Any action, suit, proceeding, or claim that", or "None.". The
   official page's typo "claim tha" is fixed to "that".
10. **One claim can't be both an Increased and an Unlimited Claim** (rule,
    from Common Paper's Help Center).
11. **Insurance Minimums** are two multi-selects (Provider, Customer) with the
    official policy lines and two money blanks each. The official "additional
    insured" sub-list became three options each, printed as the official
    lead-in plus the policy name.
12. **Payment Period and Invoice Period** are free text on the official page.
    Here they are choices built from its examples ("30 days from Customer's
    receipt of invoice"; "month, quarter, upon acceptance, after each
    milestone") plus Other, so any official answer still fits.

## Deviations from the official page

- Left out "Deliverables will meet the attached specifications": Parley can't
  attach files. Specs go in the Deliverables text.
- New headings where the official page has checkboxes with no heading of
  their own: "Drafts and Acceptance", "Security Certifications", and
  "Insurance Minimums for Provider / for Customer" (the official "For
  Provider:" / "For Customer:" lines). The group headings "Attachments and
  Supplements" and "Changes to Standard Terms" are dropped, since a part
  heading would look like a third part.
- SOW Term options carry the official lead-in: "The SOW Term begins on the SOW
  Date and ends {6 months} after the SOW Date." The "custom end date" option
  reads "…ends on {date}."
- Chosen Courts prints "The courts located in {place} (whether state,
  federal, or otherwise)": the court value already says "courts located in".
- A fixed cap prints the money value ("$250,000.00") instead of "$[ ]", so
  other currencies work.
- The signature table starts with a Company row, since the official header
  "PROVIDER: [official company name]" has no place in the engine.

## Engine gaps (reported, not changed)

1. **No "required only when…"**: rules also run on drafts, so Rejection and
   Resubmission Period (when acceptance applies) and Increased Cap Amount (when
   there are Increased Claims) are optional. An empty one still prints its
   placeholder, so it is visible, but `markComplete` won't catch it.
2. **A section holds one field**, so a value line and its checkboxes can't
   share a heading (Deliverables, Security Policy, Insurance).
3. **Part hints don't print** in the HTML or DOCX output ("The key business
   terms of this SOW are as follows:"). They are kept in the definition.
4. **No prose between parts**: the "USING THIS AGREEMENT" paragraph sits in the
   intro, before the SOW, not between the SOW and the Key Terms.
5. **No type for "any definition"**: `DocumentDefinition<Fields>` can't hold a
   real definition (its party keys become `never`), so a loop over two or more
   definitions fits no generic call. The tests now use one widened list,
   `registered` in `test/examples.ts`.
