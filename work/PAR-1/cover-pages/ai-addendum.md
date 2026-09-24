# AI Addendum cover page (T8)

Definition: `packages/documents/src/definitions/ai-addendum.ts`. Rule tests: `packages/documents/test/ai-addendum.test.ts`.
Template: `templates/AI-Addendum.md`, **AI Addendum v1.0**. Written 2026-09-24.

## Sources checked

| What | URL |
|---|---|
| Official stand-alone cover page (DOCX, scraped again on 2026-09-24) | https://commonpaper.com/standards/ai-addendum/1.0/cover-page-and-standard-terms-docx |
| AI Addendum landing page | https://commonpaper.com/standards/ai-addendum/ |
| AI Addendum 1.0 Standard Terms (the URL the template cites in 4.1) | https://commonpaper.com/standards/ai-addendum/1.0/ |
| Research report | `work/PAR-1/cover-research/csa-sla-ai-addendum.md` |

## What the page holds

Every official row, in order: Agreement, Training Data, Training Purposes, Training Restrictions, Improvement Restrictions, Covered Claims, AI Acceptable Use Policy, and the signature blocks. All 6 linked terms map to a field.

## Judgment calls (for a lawyer to look at)

1. **Intro:** the official intro, with the name and version added ("the Common Paper AI Addendum Standard Terms Version 1.0", as the template cites them). The official page puts the Agreement blank inside the sentence. Here it is its own row ("amends and is incorporated into the “Agreement” described below"). We added one sentence the official page lacks, because the brief asks for it: "If there is any inconsistency between this Cover Page and the AI Addendum Standard Terms, this Cover Page will control."
2. **Training Data, Training Restrictions, Improvement Restrictions are multi-select** with an exclusive "None" and an Other line, like the official checkboxes. The official page gives "None" only for Training Data and Training Purposes. For the two restriction rows its note says "write 'None' or delete the row", so Parley shows "None" as a box there too.
3. **Training Purposes is single-select,** not checkboxes: "solely for Customer's benefit" narrows the other option, so picking both makes no sense.
4. **Lead-in sentences** are hints: Training Data's is "Provider may Train the Model(s) using the following Training Data:" (the row has no official subtitle), and Training Purposes' is the official subtitle plus its lead-in, "Permitted Model Training. Provider may use Training Data for the following purpose:". The official page prints them between "None" and the other boxes; hints print above all the boxes.
5. **No rule ties Training Data to Training Purposes.** 1.3 allows training only when the page names both. A finished page can still say "Training Data: Usage Data" with "Training Purposes: None": it reads like a grant, but 1.3 then allows no training. Safe for the customer, but misleading; a lawyer should check both rows match. A rule can't fix it: even a one-way rule would block a draft that fills the two rows in one of the two orders.
6. **Covered Claims and the AI Acceptable Use Policy are included** (brief: add the official rows even without a linked term). Covered Claims is one multi-select with a standard and an own-words version for each side, and "None". The official text says "Provider Covered Claims **include** …": it adds to the underlying Agreement's indemnity, it doesn't replace it. So the own-words options keep "include any action, proceeding, or claim" and take the rest of the sentence. A rule allows one version per side.
7. **No defaults.** Common Paper pre-marks nothing. Its drafting note says the default is no training (1.3), which is also what an unfinished page means; the user still picks "None" on purpose.
8. **AI Acceptable Use Policy:** the official blank is "[ available at URL or attached to this Cover Page ]", so the user types the whole phrase ("available at https://…").

## Engine gaps

- Same registry typing gap as the CSA (see `csa.md`); the looping tests use `allDefinitions`.
- No "required when" for separate rows (call 5).
- "Description of Agreement" keeps the capital A: "Agreement" is a defined term.
