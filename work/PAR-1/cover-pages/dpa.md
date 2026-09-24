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
  they only show when their option is picked, and are required then (see
  "Required when" below).

## Required when (checked on a complete document only)

These rules run in the "complete" phase, so a draft can be filled in any
order. `markComplete` and export catch the blank.

- **Special Category Data Restrictions or Safeguards** when Special Category
  Data is Yes. The official drafting note: "If “Yes” is selected above,
  identify the safeguards…". GDPR needs them.
- **The subprocessor table** when "The Subprocessors listed below" is picked.
  Otherwise Annex III would be empty.
- **Described Security Measures** (at least one of the 17) when "The measures
  described below" is picked.
- **Each party's postal address.** SCC Annex I(A) asks for it, and the
  official page has an "Address" line for both. A draft still needs only an
  email or an address, like every party.
- **DPA Covered Claim** when there is a DPA Liability Cap: the cap is for "DPA
  Covered Claims", so with "None" it caps nothing (was judgment call 8).

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
8. **A DPA Liability Cap needs a DPA Covered Claim.** A complete DPA with a
   cap and "None" as the covered claim is rejected: the cap would cap nothing.

## Deviations from the official page

- **Pick lists become selects.** Three official rows are one fill-in pick,
  printed as the name picked: "EEA Transfers: [ Select an EU Member State ]",
  "UK Transfers: [ Select Laws of England and Wales; Scotland; or Northern
  Ireland ]" and "Role: [ Pick one: Controller | Processor ]". So they are
  `field.select`. Special Category Data stays a choice: the page shows two
  radio buttons, "( ) Yes ( ) No", as its own row.
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

Fixed in the engine (8b78a29 and earlier), and now used here:

1. **`field.select` works in a definition.** The Governing Member State
   (`EU_MEMBER_STATES`), UK Transfers and Customer's role are selects now.
2. **Rules know their phase.** The "required when" rules above run only on a
   complete document, so they don't block a half-filled draft.
3. **A party's postal address can be required** by the same kind of rule
   (Annex I(A)).
4. **Any definition is a `DocumentDefinition`.** Tests loop over the registry
   with no cast.

Still open:

5. **Hidden values stay stored.** A value on a hidden row (like safeguards
   after switching to "No") stays in the draft and shows on the linked term's
   hover.
6. **Long placeholders in a group.** An unticked group line prints
   "[Described security measures: Events logging]". The label shows twice.
