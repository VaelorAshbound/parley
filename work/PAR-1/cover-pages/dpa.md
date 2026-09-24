# DPA: cover page notes (T9)

Definition: `packages/documents/src/definitions/dpa.ts`. It mirrors Common Paper's
official DPA 1.1 cover page, row by row and in the same order.

## Sources checked

- Official DPA 1.1 cover page (DOCX, scraped again on 2026-09-24):
  https://commonpaper.com/standards/data-processing-agreement/1.1/cover-page-docx
- The landing page, with the annotated guide and the FAQ:
  https://commonpaper.com/standards/data-processing-agreement/
- DPA 1.1 Standard Terms: https://commonpaper.com/standards/data-processing-agreement/1.1/
  (`templates/DPA.md` matches 1.1. It does not name its own version, so the
  intro uses 1.1, the version on the official cover page.)
- EU SCCs (Decision 2021/914), Clauses 13, 17 and 18, and Annexes I–III.
- Research report: `work/PAR-1/cover-research/dpa-baa.md`.

## What the cover page holds

- **Key Terms:** Agreement, Approved Subprocessors (and the subprocessor
  table), Provider Security Contact, Security Policy.
- **Changes to the Agreement:** DPA Covered Claim, DPA Liability Cap,
  Governing Law and Chosen Courts, Service Provider Relationship (CCPA).
- **Restricted Transfers:** Governing Member State (EEA and UK lines).
- **Annex I(A):** Data Exporter (Customer) and Data Importer (Provider).
- **Annex I(B):** Service, Categories of Data Subjects, Categories of Personal
  Data, Special Category Data (and its safeguards), Frequency of Transfer,
  Nature and Purpose of Processing, Duration of Processing.
- **Annex I(C):** Competent Supervisory Authority.
- **Annex II:** security measures (See Security Policy, and/or the 17 official
  topics).
- Annex III is the Approved Subprocessors row, as Common Paper's guide says.

The Standard Terms (3.2(c)(vii), 3.3(c)) say the cover page holds the SCC
annexes. So the Annex rows are on the page even though no linked term points
to them.

## Required or optional (a blank switches its clause off)

Required, because a blank would break the DPA or GDPR:

- **Agreement:** sections 8, 9 and 10 depend on it.
- **Provider Security Contact:** a blank switches off 5.3.
- **Security Policy:** 5.2 audits against it.
- **Governing Member State (EEA):** a blank leaves SCC Clauses 17 and 18 empty.
  That makes the EEA SCCs unusable.
- **Customer's role:** it picks SCC Module Two or Three (3.2(a)–(b)).
- **Service, the categories, Special Category Data, Frequency, Nature,
  Duration:** these are the Annex I(B) items the SCCs ask for.
- **Approved Subprocessors, Annex I(C), Annex II:** Annex III, the
  supervisory authority, and the security measures the SCCs ask for.
- **The four "Changes to the Agreement" rows:** each has an explicit "None"
  (brief: "None is an answer"). So the page always says what was agreed.

Optional:

- **UK Transfers:** a blank falls back to the UK Addendum's own default
  (England and Wales).
- **The subprocessor table, the safeguards, and the described measures:**
  they only show when their option is picked. See engine gap 2.

## Judgment calls (a lawyer should look)

1. **Governing Member State lists the 27 EU states, with no default.** The
   DOCX says "EU Member State" and SCC Clause 17 says "one of the EU Member
   States". The web page says "EEA country". The law must allow third-party
   beneficiary rights, so Parley doesn't pick one.
2. **Special Category Data has no default.** Common Paper marks neither
   answer. A wrong "No" is a real GDPR risk, so the user must answer.
3. **No default for the categories, the frequency or the nature of
   processing.** Common Paper pre-marks none of them. Its guide calls
   "Continuous" typical, but it doesn't pre-mark it.
4. **Security Policy defaults to "As defined in the Agreement"**, and Annex II
   to "See Security Policy". Both are Common Paper's pre-marked picks. Together
   they leave Annex II empty when the Agreement has no security terms. The AI
   should warn about that combination.
5. **"None" option for Approved Subprocessors** (not on the official page).
   With it, a Provider with no subprocessors can say so. Then 2.6(a) approves
   none, and each new one needs notice.
6. **Annex I(A) contact person = the signer** (the party's name, title and
   email). The official page has a separate contact block. Some customers
   want their DPO here instead.
7. **Covered Claim: no default text.** Common Paper fills the blank with
   committee wording ("(1) Provider's breach…"). The engine can't set a
   default for one option alone without picking that option. The example uses
   the committee wording.
8. **DPA Liability Cap without a DPA Covered Claim** means nothing. There's no
   rule for it, because a rule would block editing the fields in either order.

## Deviations from the official page

- **Checkboxes become one choice or several.** The official page uses
  checkboxes. Rows that allow several picks use `field.choices`: Security
  Policy, the categories, Frequency, Nature, the safeguards, and Annex II.
  "[ custom option ]" becomes Other.
- **Security Policy certifications** are a nested multi-select. The list
  follows the DOCX, column by column, and uses "HIPAA" (the web page shows
  "HITRUST").
- **Approved Subprocessors:** "[ ] [ Subprocessor name ] Country of location …"
  becomes the option "The Subprocessors listed below" and a table
  (`field.list`) with the official column names. The table only shows when that
  option is picked.
- **Annex II:** "[x] See Security Policy" and the 17 topics are split into two
  rows. The first is a multi-select ("See Security Policy" / "The measures
  described below", default the first). The second is a `field.group` with the
  17 official topics, shown when the second option is picked.
- **Fixed text:**
  - Duration of Processing and Competent Supervisory Authority are one-option
    choices, picked by default. The engine prints a row only through a field,
    and "Duration of Processing" is a linked term.
  - The Nature lead-in ("Provider will Process… includes:") is the row's hint.
  - "Activities relevant to transfer: See Annex I(B)" and the importer's
    "Role: Processor" are hints too.
- **Governing Law and Chosen Courts:** the Governing State is plain text, not
  `field.jurisdiction`. The official row asks for "a state, province, or
  country", and its courts are "the courts of the Governing State". The
  jurisdiction kind would add a court-city blank the page doesn't have.
- **"Annex 1(B)"** in the official page is written "Annex I(B)", as in the SCCs.
- **Signature rows:** Signature, Print Name, Title, Company, Date. The official
  header names each company ("PROVIDER: [official company name]"), so a
  Company row keeps that. There is no Notice Address row, as in the official
  table.
- **Liability cap wording:** the page prints the amount with its currency
  ("$1,000,000.00") where the official page has "$[____]".

## Engine gaps (for the lead)

1. **`field.select` can't be used in a definition.** Its `options` are strings,
   but `AnyField.options` expects choice options, so TypeScript rejects it.
   Workaround: `field.choice`. The Member State options are built from
   `EU_MEMBER_STATES`, and in a `lines` row a choice still prints on one line.
   Also used for Customer's role and UK Transfers. Fix: rename select's
   `options`, or widen `AnyField`. Then switch these three back.
2. **No "required when".** Rules also run on drafts, and a rule issue rejects
   the edit. So "safeguards are required when Special Category Data is Yes"
   would block picking Yes before the safeguards are written. The same holds
   for the subprocessor table (when "listed") and the described measures (when
   "described"). These stay optional. The preview shows their placeholders, but
   markComplete won't catch a blank. GDPR needs the safeguards when Yes. Fix:
   rules that run only on complete documents, or `requiredWhen` on a field.
3. **A party's postal address can't be required.** Annex I(A) needs one, but
   the party kind needs only an email or an address. Same cause as gap 2.
4. **The registry can't be iterated generically.** With two or more
   definitions, `render`, `coverage` and `initialValues` can't infer `F` from
   the union. `DocumentDefinition<F>` doesn't widen to `DocumentDefinition`:
   `PartyKey<Fields>` is `never`, and `rules` is contravariant. The app will
   hit this too (render a document by id). Workaround, test-only:
   `test/each-definition.ts` visits each definition with its own types. A
   mapped type over `DocumentId` makes a new document fail to compile until it
   is listed there. Fix in `define.ts`, for example a covariant
   `AnyDocumentDefinition`.
5. **Hidden values stay stored.** A value on a hidden row (like safeguards
   after switching to "No") stays in the draft and shows on the linked term's
   hover.
6. **Long placeholders in a group.** An unticked group line prints
   "[Described security measures: Events logging]". The label shows twice.
