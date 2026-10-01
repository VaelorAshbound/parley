# Software License Agreement cover page (T11)

Definition: `packages/documents/src/definitions/software-license-agreement.ts`.
Example: `software-license-agreement` in `packages/documents/test/examples.ts`.
Rules and defaults: `test/software-license-agreement.test.ts`.

## Sources checked

- Official cover page (Order Form + Key Terms), re-scraped 2026-09-24:
  https://commonpaper.com/standards/software-license-agreement/
- The template names its version itself (§11.30: "Common Paper Software
  License Standard Terms Version 1.1", at
  https://commonpaper.com/standards/software-license-agreement/1.1).
- Help Center and research: `work/PAR-1/cover-research/psa-software-license.md`.
- The template `templates/Software-License-Agreement.md` and its outline
  `test/__outlines__/software-license-agreement.txt` (22 linked terms, all
  mapped).

## What the page holds

Title, subtitle "USING THE FRAMEWORK TERMS", then two parts in the official
order:

- **Order Form:** Software, Order Date, Subscription Period, Fees, Fee
  Increases and Taxes, Payment Process, Auto-renewal, Permitted Uses,
  Additional Permitted Uses, License Limits, Warranty Period, Deletion
  Procedure, License Compliance Verification, Services, Other Changes (this
  Order Form only).
- **Key Terms:** Effective Date, Governing Law, Chosen Courts, Covered Claims,
  General Cap Amount, Increased Claims, Increased Cap Amount, Unlimited Claims,
  Additional Warranties, DPA, Other Changes.

One closing and one signature table cover both parts.

## Judgment calls (not reviewed by a lawyer: Parley is a demo)

1. **Intro.** The official "USING THE FRAMEWORK TERMS" paragraph word for word
   (Version 1.1 and its URL): it incorporates the Standard Terms and says the
   Key Terms control. The official "Framework Terms" row follows ("…this Order
   Form will control for this Agreement"). The omitted-term rule is not added:
   the terms state it themselves in §11.1, and the official page doesn't.
2. **One signature for the Order Form and the Key Terms.** §11.8 allows it ("A
   Cover Page may include an Order Form, Key Terms, or both"). The closing
   joins the two official closings: "…each party agrees to enter into the
   Framework Terms and this Order Form." It says "the details on the Cover
   Page above", not "in the Key Terms above", because the Order Form also
   changes the terms (auto-renewal, taxes).
3. **Payment Process is one choice** with the official sentences and their
   blanks: "Pay by invoice. Provider will invoice Customer {annually}.
   Customer will pay each invoice within {30 days} from {Customer's receipt of
   invoice}." / "Automatic payment. Customer authorizes Provider to bill …
   {monthly} …". One linked term, one field, and a picked option needs all its
   blanks. The picks inside the sentence ("[ monthly | quarterly | annually |
   once per Subscription Period ]", "[ Customer's receipt of invoice | the
   invoice date ]") are `field.select` blanks, stored as `"annually"`. No default: the page marks none (the Help Center says automatic
   payment, monthly).
4. **Defaults only where the official page marks `x`:** Order Date and
   Effective Date = last signature; Auto-renewal = notice (days left empty);
   Permitted Uses = internal business purposes; Provider Covered Claims =
   standard text; General Cap = multiple (number empty); Increased Claims =
   confidentiality breach; Increased Cap = multiple (number empty); Unlimited
   Claims = indemnification. Warranty Period = "from delivery of the Software"
   with the days left empty (lead's instruction; the page itself marks no
   option, the Help Center says 30 days from delivery).
5. **Customer Covered Claims has no default.** The page leaves it unchecked;
   the Help Center says it is on by default. It is required, so the user must
   pick the standard text, their own, or "None.".
6. **General Cap Amount is required** (empty = unlimited liability). Multiple
   must be more than 0; the Increased Cap multiple more than 1.
7. **Governing law is worldwide** (`courts: "anywhere"`): the terms say "the
   Governing Law", and the page allows "state, province, and/or country".
8. **One claim can't be both an Increased and an Unlimited Claim**, and only
   one kind of fee increase can be picked (rules). A complete Order Form with
   Increased Claims also needs an Increased Cap Amount (a "complete"-phase
   rule, so drafts stay free).
9. **Warranty Period has a "None." option** with the official annotation's
   words: "None. Sections 5.2–5.4 do not apply." Required, so the choice is
   always made.
10. **License Compliance Verification** is optional: the official text or
    your own. Unpicked, both boxes print empty, so there is no audit right.

## Deviations from the official page

- **Pilot left out.** Optional, not a linked term, and the Standard Terms never
  mention a pilot. Parley has its own Pilot Agreement; pilot terms can also go
  in Other Changes.
- **Official slips fixed:** "Licensee's" → "Customer's" in the audit text;
  "a number 1" → a number; the Order Form's "COMPANY / PARTNER" signature
  labels → Provider / Customer.
- **New headings** for checkboxes that sit under another row on the official
  page: "Fee Increases and Taxes" and "Additional Permitted Uses". The group
  headings "License details", "Additions, Supplements & Modifications" and
  "Attachments, Supplements & Modifications" are dropped, since a part heading
  would look like a third part.
- "Pay by invoice." and "Automatic payment." start their option sentences, so
  one line holds the whole official row.
- Chosen Courts prints "The courts located in {place} (whether state,
  federal, or otherwise)"; the court value already says "courts located in".
- A fixed cap prints the money value with its currency, instead of "$[ ]".
- The signature table starts with a Company row (the official header
  "PROVIDER: [official company name]").

## Engine gaps

Fixed in the engine (8b78a29 and earlier), and used here:

1. **`field.select` as a choice blank.** The billing frequency and "counted
   from" picks in the Payment Process are selects now.
2. **"Required only when…":** rules know their phase. Increased Cap Amount is
   required on a complete document when there are Increased Claims.
3. **Part hints print**, and **any definition is a `DocumentDefinition`**.

Still open: **no prose between parts** and **one field per section**, as in
`cover-pages/psa.md`.
