# Design Partner Agreement: cover page notes (T10)

Definition: `packages/documents/src/definitions/design-partner-agreement.ts`. Standard Terms: Version 1.3.

## Sources checked

- Official Cover Page 1.3 (DOCX): https://commonpaper.com/standards/design-partner-agreement/1.3/cover-page-docx
- The same page as a Google Doc: https://docs.google.com/document/d/12A24v5mZntserP3wtMdvZ2Pkp5czJJuBmbmzV64rmxA/edit
- Landing page with the embedded cover page and annotations: https://commonpaper.com/standards/design-partner-agreement/
- Standard Terms 1.3: https://commonpaper.com/standards/design-partner-agreement/1.3
- v1.0 PDF with form defaults (for context only): https://commonpaper.com/wp-content/uploads/2022/09/Common-Paper-Design-Partner-Agreement-v1-cover-page-and-standard-terms.pdf
- Research report: `work/PAR-1/cover-research/pilot-design-partner-partnership.md` §2.

The rows, hints, option wording and closing were compared line by line with the 1.3 DOCX scrape.

## Version

The template (`templates/design-partner-agreement.md`) never names its own version. Its text matches 1.3, and 1.3 is the current official version, so the intro and footer cite **Version 1.3** and https://commonpaper.com/standards/design-partner-agreement/1.3.

## What the page holds (official order)

Key Terms (part) → Product · Program (Partner will) · Program (Provider will) · Effective Date · Term · Governing Law · Chosen Courts · Fees · Other Changes to Standard Terms → closing → Provider | Partner signatures.

## Judgment calls

1. **Program is two multi-selects**, one per party, both mapped from the "Program" linked term. The official row holds both lists; Parley prints them as two "Program" rows, each with the official lead-in ("As part of the Program, Partner will:" / "…Provider will:") as its hint.
2. **Partner will: at least one pick.** Section 1.2 says the Partner "will participate in the Program", so an empty list would leave that clause empty.
3. **Provider will: an explicit "None".** The official list is optional; empty means the Provider gives nothing. Following the brief ("None is an answer"), the user picks "None" instead of leaving it blank. "None" can't be picked with anything else. It is a Parley addition.
4. **No defaults except the Effective Date.** The 1.3 page pre-marks nothing. The v1.0 PDF's form defaults (1 feedback session per month, 20% discount, 6-month term) are not carried over.
5. **Effective Date has one option**, "Date of last Cover Page signature", exactly as the official page. No custom date is offered (the Pilot and Partnership pages offer one; this one doesn't).
6. **Governing law is a US state only**, because the official page says "The laws of the State of". Courts are named in full (`courts: "anywhere"`), since the page asks for "[ state and/or county ]".
7. **Fees stay in U.S. Dollars.** The official line says "in U.S. Dollars", kept word for word, so a rule asks for USD when Fees are paid. (The research proposed dropping the words; keeping them avoids changing the offer's wording.)
8. **Fees have no default.** The official page's drafting note lets the user keep either option.
9. **Term** allows months, quarters and years only, as the official "[ # ] [ months | quarters | years ]".
10. **Product** (8.7) is not a linked term, but "the Product" is defined by the Cover Page, so it is a required row.
11. **Other** is offered in both Program lists, as the official "[ other: fill in details ]". Up to 200 characters.

## Deviations from the official wording

- **Chosen Courts** prints "The state and federal courts located in [place]". This matches the official line; the jurisdiction field supplies "courts located in".
- **Other** prints as "Other: …" (the engine's fixed label), where the official page says "[ other: fill in details ]".
- **"Develop the following Product functionality:"** is followed by the text on the same line; the official page puts a free text box on the next line.
- **Intro**: word for word from the official 1.3 intro, except the link text is the version URL without "https://", as on the official page.
- **Signature rows** keep the NDA's rows, including "Company"; the official table puts the company in the column header.
- **Footer**: the brief's two lines. The official line is "Common Paper Design Partner Agreement (Version 1.3) free to use under CC BY 4.0."; Parley names the Standard Terms as the official intro does ("Common Paper Design Partner Standard Terms").

## Engine gaps

Fixed in the engine (8b78a29 and earlier), and used here:

- **`field.select` as a blank.** Both "[ month | quarter | year | term ]" picks (the Feedback sessions and the Fees) are `field.select` blanks now, stored as `"month"` and printed as the word.
- **Part headings print their hint** in the outputs.

Still open:

1. **A section holds one field**, so the one official "Program" row becomes two rows with the same heading.
2. **Choices print "None" above "Other"**, because Other is always the last line.

No "required when" rule was needed: the Fees currency check is a plain rule that already waits for the currency.
