# Cover page research, group C: Pilot, Design Partner, Partnership

Research only. No project files were changed. Pages were fetched with the firecrawl CLI on 2026-09-24. Raw scrapes are in `scratchpad/fcC/`.

## 0. Summary

**Main finding: Common Paper publishes an official cover page for all three documents.** Each one is a DOCX (and for two of them a Google Doc) linked from the standard's landing page. So Parley does not need to invent the structure. It can copy the official **section order, headings, hints and option wording** (CC BY 4.0) and write its own cover page from them, labeled "Cover page by Parley, not by Common Paper".

| Document | Template version (repo) | Official cover page found | Called |
|---|---|---|---|
| Pilot Agreement | 1.1 (def. 8.17) | Yes: [DOCX 1.1](https://commonpaper.com/standards/pilot-agreement/1.1/cover-page-docx), [Google Doc](https://docs.google.com/document/d/1Dx2SEXT32zWBK-cB1qFx3x2hmfy5G52gk0YPJLHRWo4/edit) | **Order Form** |
| Design Partner Agreement | 1.3 (no self-reference in the file; the section text matches 1.3) | Yes: [DOCX 1.3](https://commonpaper.com/standards/design-partner-agreement/1.3/cover-page-docx), [landing preview](https://commonpaper.com/standards/design-partner-agreement/), [v1.0 PDF with form defaults](https://commonpaper.com/wp-content/uploads/2022/09/Common-Paper-Design-Partner-Agreement-v1-cover-page-and-standard-terms.pdf) | **Cover Page** (Key Terms) |
| Partnership Agreement | says 1.0 (def. 13.19), but the text is 1.1 (see §3.0) | Yes: [DOCX 1.0](https://commonpaper.com/standards/partnership-agreement/1.0/cover-page-docx), [1.1 preview + annotations](https://commonpaper.com/standards/partnership-agreement/) | **Cover Page** (Business Terms + Key Terms) |

### Terms that need a field kind Parley doesn't have

1. **Multi-select (checklist), each option with its own nested value.** Needed for: Design Partner **Program** (per party), Partnership **Obligations** (per party), **Increased Claims**, **Unlimited Claims**, **Payment Process**, **Additional Warranties**, **Brand Guidelines**. The official pages mark these with `[ ]` ("pick none, one, or more than one", [Partnership annotations](https://commonpaper.com/standards/partnership-agreement/)). This is the multi-select that ADR/T6 deferred ("T8–T11 add it if one does"). **These templates need it.**
2. **An option with more than one blank.** Examples: "The greater of $[amount] or [number]x the fees…", Design Partner Fees "[$] per [month | quarter | year | term] … within [#] days", "Participate in [#] Feedback sessions per [month | quarter | year | term]", Pilot "within [#] days from [receipt of invoice | the invoice date]". Today a choice option takes ONE nested field. Proposal: `with` accepts a small record, e.g. `{ amount: field.money(), times: field.number() }`, and the label uses `{amount}` / `{times}`.
3. **A number (multiplier) kind.** "[Fill in a number]x the Fees paid or payable…" is on every General / Increased Cap Amount. `percent` doesn't fit (2x = 200%). Proposal: `number` with min/max/decimals (for example 0.01–100, 2 decimals), shown as "2×".
4. **Per-party values** (Obligations, Program, Additional Warranties, Brand Guidelines, Covered Claims). No new kind is needed: use one field per party and map the linked term to both paths (`linkedTerms` already takes an array). **Engine gap:** when an *optional* path is empty, the hover should skip it, not show a `[placeholder]`.
5. **Small gaps in existing kinds:**
   - Duration has no `quarters` (Design Partner Term and Fees period offer "quarters"). Also, a duration field can't limit its units: a Term of "5 hours" should be impossible.
   - Jurisdiction is US-only. The official Pilot and Partnership pages say "state, province, and/or country". The Design Partner page says "the State of", which fits.
   - Choice "Other" text is capped at 200 characters. That's fine for Territory / End Date, too short for a custom Covered Claim, so that one needs a longText option.
6. **Notice Address.** This is not a field. It is each party's email and/or postal address, already in the `party` field and already shown in the signature table's "Notice Address" row (`render.ts` SIGNATURE_ROWS). Proposal: a virtual path `<party>.notice` that `show()` renders exactly like the signature row. Then map `"Notice Address": ["provider.notice", "customer.notice"]`. Fallback without engine change: `["provider.email", "customer.email"]`, as `test/fixtures.ts` does. But a party that gave only a postal address would then hover as a placeholder, which is wrong.

### Biggest legal judgment calls (details per document)

- **A liability cap tied to fees can be $0.** Pilot defaults to "Free Pilot", and many partnerships have no fees, but the official default cap is "[N]x the Fees". Common Paper itself says "In general, a $0 liability cap would be unenforceable" and made the hybrid option "greater" to avoid a $0 cap ([Partnership annotations](https://commonpaper.com/standards/partnership-agreement/)). **Proposal:** a cross-field rule that flags "multiple of fees" when no fees are due.
- **An empty cap removes the cap.** The official drafting note says: "If there is no General Cap Amount, … the Agreement will not have a limitation of liability" (all three sources). Parley should make General Cap Amount **required**, with no default amount. Otherwise a user who skips it silently gets unlimited liability.
- **Fields the template never links but the official cover page has**: Pilot **Product**, **Fees**, Payment Process, DPA, Technical Support; Design Partner **Product**. "Product" and "Fees" are *defined* by the Order Form / Cover Page (Pilot 8.10, 8.14; Design Partner 8.7), so leaving them off leaves the contract without a product. **Proposal:** include Product (required) and Fees. Make the others optional. The coverage check already counts cover-page section fields as "used" (`define.ts` lines 170–178), so this passes.
- **Effective Date.** The official Pilot and Partnership pages offer "( x ) Date of last signature" or a custom date. The official Design Partner page has only "Date of last Cover Page signature". The NDA in Parley uses a plain date that defaults to today. **Proposal:** a choice here, to mirror the official pages (details below).
- **Partnership template version mismatch.** See §3.0.
- **Partnership has no termination for convenience.** An "Until terminated by either party" End Date (Common Paper's own suggestion) means only for-cause termination. The help text should say so.
- **Indemnity defaults.** Common Paper leaves Covered Claims unchecked but supplies Committee default wording. Is pre-selecting both mutual defaults right? That's a judgment call. I propose yes (symmetric, Committee wording).
- **Currency.** Design Partner Fees says "in U.S. Dollars". Parley's `money` has a currency. Either lock the currency to USD or drop the words "in U.S. Dollars". I propose dropping them, because the rendered amount already shows the currency.

---

## 1. Pilot Agreement (Order Form), v1.1

### Sources
- Standard terms 1.1: https://commonpaper.com/standards/pilot-agreement/1.1 (released July 23, 2025)
- Landing page / formats: https://commonpaper.com/standards/pilot-agreement/ ("fill in the details in the Order Form. Finally, sign the Order Form…")
- **Official Order Form 1.1**: https://commonpaper.com/standards/pilot-agreement/1.1/cover-page-docx, and the Google Doc https://docs.google.com/document/d/1Dx2SEXT32zWBK-cB1qFx3x2hmfy5G52gk0YPJLHRWo4/edit
- Release note: https://commonpaper.com/release-notes/common-paper-pilot-agreement-v1-1/
- Template: `templates/Pilot-Agreement.md`. Definitions: 8.1 Defining Variables ("default meaning will be 'none'"), 8.2 Agreement, 8.10 Fees ("amounts described in an Order Form"), 8.13 Order Form ("signed or electronically accepted… incorporates these Standard Terms… includes the key business details and Variables"), 8.14 Product ("described in the Order Form").

### Official Order Form, as published (the order Parley should mirror)
Intro "USING THE ORDER FORM" → **Order Form** ("The key business and legal terms of this Agreement are as follows:"): Product · Effective Date ("The date the Pilot Agreement starts") · Pilot Period · Fees · Payment Process · Governing Law · Chosen Courts ("Jurisdiction or where disputes are filed") · General Cap Amount ("Limitation of liability amount for most claims") → **Attachments, Supplements & Modifications**: DPA ("Data Processing Agreement") · Technical Support · Other Changes to Standard Terms ("List specific changes to the Standard Terms") → closing line → signatures **PROVIDER | CUSTOMER** (Signature, Print Name, Title, Notice Address "Use email or postal address", Date) → "Common Paper Pilot Agreement (Version 1.1) free to use under CC BY 4.0."

**Title:** the standard terms say "Order Form" 25+ times (8.1, 8.2, 8.13…), so Parley's page should be **titled "Order Form"**, not "Cover Page". The Parley label still applies.

### Proposed sections and fields

| # | Section heading | Hint (one line) | Field key | Kind | Label | Help (≤15 words) | Options / wording | Default | Optional |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Product | What the Customer will try | `product` | longText | Product | The product the Customer will test during the pilot. | Official line: "The Product available under this Order Form is [description of the product]." | none | No |
| 2 | Effective Date | The date the Pilot Agreement starts *(official)* | `effectiveDate` | choice | Effective date | The date this Pilot Agreement starts. | `lastSignature`: "Date of last signature on this Order Form" · `custom`: "{value}" (nested **date**, label "Start date", help "The day the pilot agreement starts.") | `lastSignature` *(official "( x )")* | No |
| 3 | Pilot Period | How long the Customer may use the Product | `pilotPeriod` | duration | Pilot period | How long the Customer may use the Product. | Official: "[ Fill in length of license, e.g. 3 months ]" | `{3, months}` *(official example)* | No |
| 4 | Fees | What the Customer pays for the pilot | `fees` | choice | Fees | What the Customer pays for the pilot, if anything. | `free`: "Free Pilot" · `paid`: "{value}. Fees are non-refundable and exclusive of taxes." (nested **text**, label "Fee details", help "What the Customer pays, like $5,000 for the Pilot Period.") | `free` | No |
| 5 | Payment Process | How the Customer pays | `paymentProcess` | choice | Payment process | How and when the Customer pays the Fees. | `invoice`: "Customer will pay Fees within {value} from Customer's receipt of invoice." (nested **duration**, default 30 days) · `automatic`: "Customer authorizes Provider to automatically bill and charge the credit card, debit card, or other payment method on file for Fees {value} for immediate payment or deduction without further approval. Provider will make a copy of Customer's bills or transaction history available to Customer." (nested cadence: "monthly / quarterly / annually / once per Pilot Period", **needs multi-slot or a nested choice**; fallback: nested text) | none | Yes (rule: required when `fees` = paid) |
| 6 | Governing Law & Chosen Courts | Jurisdiction or where disputes are filed *(official)* | `governingLaw` | jurisdiction | Governing law & courts | Which state's laws apply, and where disputes are filed. | Lines: "Governing Law" → `governingLaw.state`; "Chosen Courts" → `governingLaw.courtLocation` | none | No |
| 7 | General Cap Amount | Limitation of liability amount for most claims *(official)* | `generalCap` | choice | General cap amount | The most either party can owe for most claims. | `multiple`: "{value}x the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim" (**needs number**) · `fixed`: "{value}" (nested **money**) · `greater`: "The greater of {amount} or {times}x the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim" (**needs multi-slot + number**; official: "a number other than 1") | **none** (see judgment) | **No** (see judgment) |
| 8 | DPA | Data Processing Agreement *(official)* | `dpa` | text | DPA | Attach or say where to find a data processing agreement. | Official: "[ Attach or describe where to find. ]" | none | Yes |
| 9 | Technical Support | Support included in the pilot | `technicalSupport` | longText | Technical support | What support is included, and how the Customer gets it. | Official: "[ Describe included support and/or how Customer can receive support ]" | none | Yes |
| 10 | Other Changes to Standard Terms | List specific changes to the Standard Terms *(official)* | `modifications` | longText | Changes to standard terms | List any changes to the Standard Terms. | — | none | Yes |
| sig | PROVIDER / CUSTOMER | — | `provider`, `customer` | party | Provider / Customer | Provider: "The company whose product is being piloted." Customer: "The company trying the product." | — | — | No |

Sections 8–10 go under a sub-heading "Attachments, Supplements & Modifications" (official).

**Closing (official):** "Provider and Customer have not changed the Standard Terms except for the details in the Order Form above. By signing this Order Form, each party agrees to enter into the Agreement."
**Footer:** "Common Paper Pilot Agreement (Version 1.1) free to use under CC BY 4.0." plus the Parley label.

### Linked-term map
| Term (count) | Field path |
|---|---|
| Customer (35) incl. "Customer's" | `customer.company` |
| Provider (27) incl. "Provider's" | `provider.company` |
| Pilot Period (3) | `pilotPeriod` |
| Effective Date (3) | `effectiveDate` |
| General Cap Amount (1) | `generalCap` |
| Governing Law (1) | `governingLaw.state` |
| Chosen Courts (2) | `governingLaw.courtLocation` |
| Notice Address (1) | `["provider.notice", "customer.notice"]` (proposed virtual part; fallback `.email`) |

Not linked, but on the page: `product` (8.14), `fees` (7.8, 7.11, 8.10), `paymentProcess`, `dpa`, `technicalSupport`, `modifications`.

### Rules
- Provider and Customer must be different companies (same as the NDA).
- `fees` = paid → `paymentProcess` is required. `fees` = free → hide `paymentProcess` (or ignore it).
- `fees` = free and `generalCap` is `multiple` or `greater` with 1x → issue: "With a free pilot, a cap tied to fees is $0. Pick a dollar amount."

### Judgment calls (Pilot)
1. **General Cap default.** The official default is "( x ) [N]x the Fees". Parley's default Fees is "Free Pilot", so that combination gives a $0 cap. Proposal: no default, required, plus the rule above. The official note says an omitted cap means "the contract will not have any limitation of liability". A Parley user should never get that by skipping a field.
2. **Product and Fees are included although not linked.** Without Product, "the Product" in 1.1 has no meaning (8.14). The General Cap wording and 7.8 Taxes depend on "Fees".
3. **Pilot Period as a length only** (official: "length of license, e.g. 3 months"). Its start is implied by 2.1 ("start on the Effective Date and … continue through the Pilot Period"). Alternative: render "{value} from the Effective Date" for clarity (a Parley wording change).
4. **Payment Process simplified.** "[ Customer's receipt of invoice | the invoice date ]" is reduced to receipt of invoice until multi-slot options exist. The template never names Payment Process, so it could also be dropped. I keep it because paid pilots need it.
5. **Governing law outside the US** (official allows "state, province, and/or country") is not supported by `jurisdiction`.

---

## 2. Design Partner Agreement, v1.3

### Sources
- Landing + embedded cover page + annotations: https://commonpaper.com/standards/design-partner-agreement/ (current version 1.3)
- Standard terms 1.3: https://commonpaper.com/standards/design-partner-agreement/1.3
- **Official Cover Page 1.3**: https://commonpaper.com/standards/design-partner-agreement/1.3/cover-page-docx, and the Google Doc https://docs.google.com/document/d/12A24v5mZntserP3wtMdvZ2Pkp5czJJuBmbmzV64rmxA/edit
- v1.0 PDF with filled form defaults ("Feedback sessions: [1]", "Future Product discount: [20%]", "Term number: [6]", "Dropdown 1: month"): https://commonpaper.com/wp-content/uploads/2022/09/Common-Paper-Design-Partner-Agreement-v1-cover-page-and-standard-terms.pdf
- GitHub: https://github.com/CommonPaper/Design-Partner-Agreement ("download a copy of the Cover Page… input those terms into the corresponding bracketed section")
- Benchmark figures quoted in the annotations (72% feedback, 64% private lists, 61% public lists, 43% future discount, 49% term of 3 or 6 months): https://commonpaper.com/resources/contract-benchmark-2024-Q1 (via the landing page)
- Template: `templates/design-partner-agreement.md`. Definitions: 8.1 Agreement, 8.4 Cover Page ("signed or electronically accepted… identifies Provider and Partner"), 8.7 Product ("described in the Cover Page"). Note: it has no "Defining Variables" clause. The official cover intro supplies the "none / not applicable" rule instead, so **Parley's intro must include that sentence**.

### Official cover page, as published
Intro "USING THIS AGREEMENT" → **Key Terms** ("The key legal terms of this Agreement are as follows:"): Product · Program · Effective Date ("The date the Agreement starts") · Term · Governing Law · Chosen Courts ("Jurisdiction or where disputes are filed") · Fees · Other Changes to Standard Terms ("List specific changes to the Standard Terms") → closing → **PROVIDER | PARTNER** signatures → "Common Paper Design Partner Agreement (Version 1.3) free to use under CC BY 4.0."

### Proposed sections and fields

| # | Section heading | Hint | Field key | Kind | Label | Help (≤15 words) | Options / wording | Default | Optional |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Product | The product being developed | `product` | longText | Product | Name and short description of the product the Partner helps build. | Official: "The Product is [ description of the product being developed ]." | none | No |
| 2 | Program | What each party does in the design partner program | `programPartner` | **checklist (new)** | Partner will | What the Partner does in the program. | "As part of the Program, Partner will:" · `feedback`: "Participate in {count} Feedback sessions per {period}" (**multi-slot**: number + month/quarter/year/term; fallback "Participate in Feedback sessions: {value}" with text) · `caseStudy`: "Provide case study that can be shared with others" · `privateLists`: "Appear as a customer in private customer lists" · `publicLists`: "Appear as a customer on Provider's website and public customer lists" · `reference`: "Serve as a reference for prospective customers" · Other (free text) | `[feedback: 1 per month]` *(v1.0 form default; benchmark says 72% include feedback)* | No (rule: at least one) |
| 2 | (same section) | | `programProvider` | **checklist (new)** | Provider will | What the Provider gives the Partner in return. | "As part of the Program, Provider will:" · `discount`: "Give a {value} discount to Partner if Partner signs a long-term customer agreement for the Product after completing the Program" (nested text "flat amount or percentage", e.g. "20%") · `functionality`: "Develop the following Product functionality: {value}" (nested longText) · Other | none (the annotation says this list is optional) | Yes |
| 3 | Effective Date | The date the Agreement starts *(official)* | `effectiveDate` | choice | Effective date | The date this Agreement starts. | `lastSignature`: "Date of last Cover Page signature" *(official, the only official option)* · `custom`: "{value}" (nested date), a **Parley addition** | `lastSignature` | No |
| 4 | Term | How long the program lasts | `term` | duration (units months / years; "quarters" missing) | Term | How long the Agreement and the program last. | Official: "[ # ] [ months \| quarters \| years ]" | `{6, months}` *(v1.0 form default; benchmark: 49% are 3 or 6 months)* | No |
| 5 | Governing Law & Chosen Courts | Jurisdiction or where disputes are filed *(official)* | `governingLaw` | jurisdiction | Governing law & courts | Which state's laws apply, and where disputes are filed. | Official: "The laws of the State of [state]" / "The state and federal courts located in [state and/or county]". Lines: Governing Law → `.state`, Chosen Courts → `.courtLocation` | none | No |
| 6 | Fees | What the Partner pays, if anything | `fees` | choice | Fees | What the Partner pays to use the Product, if anything. | `none`: "There are no Fees under this Agreement." · `paid`: "During the Term, Partner will pay Provider {amount} per {period} (excluding taxes) to access and use the Product. This amount reflects a discount for Partner's Feedback and participation in the Program. Partner will pay the fee within {days} from receipt of invoice." (**multi-slot**: money + period choice [month \| quarter \| year \| term] + duration; the official text also says "in U.S. Dollars", see judgment) | `none` | No |
| 7 | Other Changes to Standard Terms | List specific changes to the Standard Terms *(official)* | `modifications` | longText | Changes to standard terms | List any changes to the Standard Terms. | — | none | Yes |
| sig | PROVIDER / PARTNER | — | `provider`, `partner` | party | Provider / Partner | Provider: "The company building the product." Partner: "The early user giving feedback on the product." | — | — | No |

**Closing (official):** "Provider and Partner have not changed the Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this Agreement as of the Effective Date."

### Linked-term map
| Term (count) | Field path |
|---|---|
| Partner (20) incl. "Partner's" | `partner.company` |
| Provider (18) incl. "Provider's" | `provider.company` |
| Term (3) | `term` |
| Program (6) | `["programPartner", "programProvider"]` |
| Fees (1) | `fees` |
| Effective Date (3) | `effectiveDate` |
| Governing Law (1) | `governingLaw.state` |
| Chosen Courts (2) | `governingLaw.courtLocation` |
| Notice Address (1) | `["provider.notice", "partner.notice"]` |

Not linked, but on the page: `product` (8.7), `modifications`.

### Fallback with today's kinds (no multi-select, no multi-slot)
- `programPartner`, `programProvider` become **longText**, pre-filled with the official lines as a starting point. The user loses the structure, but it works.
- `fees.paid` → split into `perMonth` / `perQuarter` / `perYear` / `perTerm` options, each with a nested money field. Plus a separate optional `feePaymentDays` duration (default 30 days). Or one nested longText for the whole sentence.

### Rules
- Provider and Partner must be different companies.
- `programPartner` has at least one item. Section 1.2 obliges the Partner to "participate in the Program", so an empty Program leaves that clause empty.

### Judgment calls (Design Partner)
1. **Effective Date custom option** is a Parley addition. The official page is fixed to "Date of last Cover Page signature". I keep both for consistency with the Pilot and Partnership pages. Dropping `custom` would match the official page exactly.
2. **"in U.S. Dollars"**: drop it (the money value shows the currency) or lock the currency to USD. Both are defensible. Dropping it is the more flexible choice. Note that 2.1 of the terms says nothing about currency.
3. **Default Program items.** Only `feedback` is pre-checked. Case study and customer lists are publicity rights the Partner grants, so opting in should be a conscious act.
4. **Term units.** Offer months/years only, or add `quarters` to duration.

---

## 3. Partnership Agreement, v1.0 (as the file states)

### 3.0 Version mismatch in the repo template (flag)
`templates/Partnership-Agreement.md` 13.19 says "**Version 1.0** … commonpaper.com/standards/partnership-agreement/1.0". But its text has the two **1.1** fixes ([version history](https://commonpaper.com/standards/partnership-agreement/versions)):
- 6.5 reads "Section 9 (Limitation of Liability)". The hosted 1.0 reads "Limitation not Liability" ([1.0](https://commonpaper.com/standards/partnership-agreement/1.0)).
- 11.3 reads "the Discloser". The hosted 1.0 reads "Disclosing Party".

In 12.7, "Notice Address" is plain text (not linked) in the file and in the hosted 1.0. The 1.1 preview bolds it. So the file is 1.1 wording with a 1.0 self-reference. **Decide before T10:** cite 1.0 on Parley's cover page (to match 13.19 in the text we show), or treat the file as 1.1. The "word for word" rule argues for citing what 13.19 says (1.0), with a note in `cover-pages.md`. No Notice Address link is needed for this document, but the signature table still shows each party's notice address.

### Sources
- Landing + 1.1 cover preview + **full annotations**: https://commonpaper.com/standards/partnership-agreement/
- Standard terms: https://commonpaper.com/standards/partnership-agreement/1.0 and https://commonpaper.com/standards/partnership-agreement/1.1
- **Official Cover Page 1.0**: https://commonpaper.com/standards/partnership-agreement/1.0/cover-page-docx (1.1: https://commonpaper.com/standards/partnership-agreement/1.1/cover-page-docx)
- Versions: https://commonpaper.com/standards/partnership-agreement/versions
- Template: `templates/Partnership-Agreement.md`. Definitions: 13.1 Defining Variables, 13.7 Cover Page ("identifies Company and Partner… includes definitions or descriptions for Variables"), 13.8 Covered Claim, 13.11 Fees ("amounts described in a Cover Page that one party owes"), 13.14/13.15 Licensor / Licensee, 13.20 Variable.

### Official cover page 1.0, as published
Intro "USING THIS AGREEMENT" → **Business Terms**: Obligations · Territory · Payment Process · Payment Schedule · End Date ("When this Agreement ends") → **Key Terms**: Effective Date ("The date the Agreement starts") · Governing Law · Chosen Courts ("Jurisdiction or where disputes are filed") · Covered Claims ("Claims covered by indemnity obligations") · General Cap Amount ("Limitation of liability amount for most claims") · Increased Claims ("Specific claims covered by the Increased Cap Amount") · Increased Cap Amount ("Higher limitation of liability amount for Increased Claims, often called a supercap") · Unlimited Claims ("Claims excluded from any liability cap") · Additional Warranties → **Attachments and Supplements**: DPA ("Data Protection Agreement") · Brand Guidelines → **Changes to Standard Terms** → closing → **COMPANY | PARTNER** signatures.

### Proposed sections and fields

**Business Terms**, "The key business terms of this Agreement are as follows:"

| # | Heading | Hint | Key | Kind | Label | Help (≤15 words) | Options / wording (official) | Default | Optional |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Obligations | What each party will do | `companyObligations` | **checklist (new)** | Company will | What the Company will do in this partnership. | `promoActivities`: "Engage in the following promotional activities: {value}" · `promoMaterials`: "Provide the following promotional materials: {value}" · `sponsoredBenefits`: "Provide the following sponsored benefits: {value}" · `referrals`: "Make Referrals to Partner. A "Referral" to Partner is a third party that meets all the following criteria: {value}" · `payment`: "Pay Partner the following amount according to the Payment Schedule: {value}" · `brandElements`: "Provide Company's Brand Elements as Licensor" (no value). Nested: longText | none | Yes* |
| 1 | (same) | | `partnerObligations` | **checklist (new)** | Partner will | What the Partner will do in this partnership. | Mirror image: "…Make Referrals to Company. A "Referral" to Company is…", "Pay Company the following amount…", "Provide Partner's Brand Elements as Licensor" | none | Yes* |
| 2 | Territory | Where the partnership happens | `territory` | choice | Territory | Where the partners may use each other's brand. | `worldwide`: "Worldwide" · `areas`: "{value}" (nested text, "specific geographic areas") | `worldwide` *(official "[ x ]")* | No |
| 3 | Payment Process | Where to send invoices | `paymentProcess` | **checklist (new)** | Payment process | Where each party sends invoices for Fees. | `companyBills`: "Company will send invoices or bills for Fees owed by Partner to: {value}" · `partnerBills`: "Partner will send invoices or bills for Fees owed by Company to: {value}" (nested text: an email or address) | none | Yes (rule) |
| 4 | Payment Schedule | When payments are due | `paymentSchedule` | longText | Payment schedule | When the paying party pays, like 30 days from receipt of invoice. | Official: "The party making payment will pay the other party according to the following schedule: [ … ]". Examples from Common Paper: "30 days from receipt of invoice", "60 days before event", "by a specific date", "upon certain milestones" | none | Yes (rule) |
| 5 | End Date | When this Agreement ends *(official)* | `endDate` | choice (+ Other) | End date | When this Agreement ends. | `afterEffective`: "{value} after the Effective Date" (duration) · `onDate`: "{value}" (date; a Parley split of "[fill in custom end date]") · Other: free text, e.g. "Until terminated by either party." *(Common Paper annotation)* | `{afterEffective, 1 year}` *(official default option is "[ x ]"; the length 1 year is Parley's choice)* | No |

\*Rule: at least one obligation across both lists (official drafting note: "Choose at least one").

**Key Terms**, "The key legal terms of this Agreement are as follows:"

| # | Heading | Hint | Key | Kind | Label | Help (≤15 words) | Options / wording (official) | Default | Optional |
|---|---|---|---|---|---|---|---|---|---|
| 6 | Effective Date | The date the Agreement starts | `effectiveDate` | choice | Effective date | The date this Agreement starts. | `lastSignature`: "Date of last signature on this Cover Page" · `custom`: "{value}" (date) | `lastSignature` *(official "[ x ]")* | No |
| 7 | Governing Law & Chosen Courts | Jurisdiction or where disputes are filed | `governingLaw` | jurisdiction | Governing law & courts | Which state's laws apply, and where disputes are filed. | Official: "The laws of [state and/or country]" / "The courts (whether state, federal, or otherwise) located in [state and/or county]" | none | No |
| 8 | Covered Claims | Claims covered by indemnity obligations | `companyCoveredClaim` | choice | Company Covered Claim(s) | Claims the Company will defend the Partner against. | `standard`: "Any action, suit, proceeding, or claim that arises out of or relates to (a) Company's gross negligence or willful misconduct; or (b) Company's breach or alleged breach of its representations and warranties in Section 7, including the intellectual property representations or warranties." · `custom`: "Any action, suit, proceeding, or claim that arises out of or relates to {value}" (longText) | `standard` (see judgment) | Yes |
| 8 | (same) | | `partnerCoveredClaim` | choice | Partner Covered Claim(s) | Claims the Partner will defend the Company against. | Mirror image with "Partner's" | `standard` | Yes |
| 9 | General Cap Amount | Limitation of liability amount for most claims | `generalCap` | choice | General cap amount | The most either party can owe for most claims. | `multiple`: "{value} times the fees paid or payable under the Agreement in the 12 month period immediately before the claim" (**number**) · `fixed`: "{value}" (money) · `greater`: "The greater of {amount} or {times} times the fees paid or payable under the Agreement in the 12 month period immediately before the claim" (**multi-slot**) | none | **No** (judgment) |
| 10 | Increased Claims | Specific claims covered by the Increased Cap Amount | `increasedClaims` | **checklist (new)** + Other | Increased claims | Claims with a higher liability cap. | "Breach of Section 11 (Confidentiality)" · "An Indemnifying Party's indemnification obligations for its Covered Claims" · "Breach of Section 11 (Confidentiality) resulting from gross negligence or willful misconduct" · "Claims resulting from a party's gross negligence or willful misconduct" · "Other: {value}" | none | Yes |
| 11 | Increased Cap Amount | Higher liability limit for Increased Claims, often called a supercap | `increasedCap` | choice | Increased cap amount | The higher liability limit for Increased Claims. | Same three options as `generalCap`. Official: "[Fill in a number other than 1] times…" and "The greater of $[…] or […]x the fees…" | none | Yes (rule) |
| 12 | Unlimited Claims | Claims excluded from any liability cap | `unlimitedClaims` | **checklist (new)** + Other | Unlimited claims | Claims with no liability cap at all. | Official order: "An Indemnifying Party's indemnification obligations for its Covered Claims" · "Breach of Section 11 (Confidentiality)" · "Breach of Section 11 (Confidentiality) resulting from gross negligence or willful misconduct" · "Claims resulting from a party's gross negligence or willful misconduct" · "Other: {value}" | none | Yes |
| 13 | Additional Warranties | Extra promises either party makes | `additionalWarranties` | **checklist (new)** | Additional warranties | Extra promises beyond those in Section 7. | `byCompany`: "By Company: {value}" · `byPartner`: "By Partner: {value}" (longText) | none | Yes |

**Attachments and Supplements**

| # | Heading | Hint | Key | Kind | Label | Help | Wording | Default | Optional |
|---|---|---|---|---|---|---|---|---|---|
| 14 | DPA | Data Protection Agreement *(official wording; see note)* | `dpa` | text | DPA | Attach or say where to find the data processing agreement. | "[ If required by law or appropriate for the Obligations, attach or describe where to find. ]" | none | Yes |
| 15 | Brand Guidelines | Rules for using each party's brand | `brandGuidelines` | **checklist (new)** | Brand guidelines | Where to find each party's brand rules. | `company`: "Company Brand Guidelines: {value}" · `partner`: "Partner Brand Guidelines: {value}" (text: attach or describe where to find) | none | Yes |

**Changes to Standard Terms**

| 16 | Changes to Standard Terms | List specific changes to the Standard Terms | `modifications` | longText | Changes to standard terms | List any changes to the Standard Terms. | — | none | Yes |
|---|---|---|---|---|---|---|---|---|---|

**Signatures:** `company` (party, "Company", help "One side of the partnership, often your company."), `partner` (party, "Partner", help "The other company in the partnership."). The Common Paper annotation says either side may be "Company". **Closing (official 1.0):** "Company and Partner have not changed the Standard Terms except for the details in the Cover Page above. By signing this Cover Page, each party agrees to enter the Agreement as of the Effective Date."

### Linked-term map
| Term (count) | Field path |
|---|---|
| Obligations (8) | `["companyObligations", "partnerObligations"]` |
| Payment Process (1) | `paymentProcess` |
| Payment Schedule (1) | `paymentSchedule` |
| Territory (1) | `territory` |
| End Date (1) | `endDate` |
| Company (8) | `company.company` |
| Partner (8) | `partner.company` |
| Brand Guidelines (1) | `brandGuidelines` |
| DPA (4) | `dpa` |
| Effective Date (2) | `effectiveDate` |
| Additional Warranties (1) | `additionalWarranties` |
| General Cap Amount (1) | `generalCap` |
| Increased Claims (4) | `increasedClaims` |
| Increased Cap Amount (1) | `increasedCap` |
| Unlimited Claims (1) | `unlimitedClaims` |
| Company Covered Claim (3) | `companyCoveredClaim` |
| Partner Covered Claims (2), Partner Covered Claim (1) | `partnerCoveredClaim` |
| Governing Law (2) | `governingLaw.state` |
| Chosen Courts (2) | `governingLaw.courtLocation` |

(Notice Address is not linked in this template. The signature table covers it.)

### Fallback with today's kinds
- Each checklist becomes one optional **longText** per party or per list, pre-filled with the official lines as a guide. Examples: `companyObligations`, `partnerObligations`, `increasedClaims`, `unlimitedClaims`. This works, but the user loses the checkboxes and the rules below can't read the choices.
- Payment Process, Additional Warranties and Brand Guidelines → two optional `text` / `longText` fields each (one per party), with the linked term mapped to both. This needs the "skip empty optional path in hover" fix.
- The cap multiplier → a nested `text` ("2") until `number` exists. Not recommended, because it loses typing.

### Rules
- Company and Partner must be different companies.
- At least one obligation across `companyObligations` + `partnerObligations`.
- Any `payment` obligation → `paymentSchedule` required (official: "If there are Fees included as part of Obligations, this Variable is required"). Also require the matching `paymentProcess` item: Partner pays → `companyBills`, Company pays → `partnerBills`.
- `increasedClaims` set → `increasedCap` required (official: "must be set if you are including Increased Claims"). `increasedCap` without `increasedClaims` → issue.
- The same claim in both `increasedClaims` and `unlimitedClaims` → issue. This is Parley's rule, based on 9.3: an unlimited claim makes the increased cap moot.
- `increasedCap` multiple = 1 → issue (official: "a number other than 1").
- No `payment` obligation and `generalCap` is `multiple` → issue: "No fees are paid, so this cap is $0. Pick a dollar amount." (Common Paper: "In general, a $0 liability cap would be unenforceable.")
- Soft: `brandGuidelines.company` set but Company doesn't provide Brand Elements (and the same for Partner) → hint.

### Judgment calls (Partnership)
1. **Version** (see §3.0).
2. **General Cap required, no default.** Common Paper makes it optional, where an omitted cap means no limitation of liability. Many partnerships have no fees, so a "multiple of fees" default is risky.
3. **Covered Claims pre-selected with the Committee defaults** for both sides (mutual). Common Paper leaves both boxes unchecked. Alternative: default to none. Indemnities matter, so the UI should explain them either way.
4. **End Date "Until terminated by either party"**: there is no termination for convenience in 6.2. Help text: "There is no termination for convenience; add one under Changes to Standard Terms." ([Common Paper note](https://commonpaper.com/standards/partnership-agreement/))
5. **DPA label.** The official cover page expands it as "Data Protection Agreement", while Common Paper's own DPA standard is a "Data Processing Agreement". Parley should use one consistent expansion, and could later offer Parley's own DPA document here.
6. **Currency.** 2.1(a) defaults Fees to U.S. Dollars "unless the Cover Page specifies a different currency". The payment amounts are free text inside Obligations, so the user writes the currency there. No separate field is needed.
7. **Governing law outside the US** (official: "state and/or country") is not supported.

---

## 4. Cross-cutting notes for T10

- **Intro, closing and footer text.** The official "USING THIS AGREEMENT / ORDER FORM" paragraphs, the closing lines and the attribution are on public CC BY 4.0 pages, so Parley may adapt them with attribution. They must be marked as changed, which the "Cover page by Parley, not by Common Paper" label does. Each intro must name the exact version URL: Pilot 1.1, Design Partner 1.3, Partnership 1.0 (§3.0).
- **Design Partner needs the "none / not applicable" sentence in its intro.** Its standard terms have no "Defining Variables" clause (Pilot 8.1 and Partnership 13.1 do).
- **Signature order** follows the official pages: Pilot PROVIDER | CUSTOMER, Design Partner PROVIDER | PARTNER, Partnership COMPANY | PARTNER.
- **Hints marked *(official)*** are Common Paper's own row sub-labels. They are safe to reuse and match the NDA approach.
- **Coverage check.** Non-linked fields (Product, Fees, DPA, Technical Support, modifications) are "used" because they appear as cover-page sections (`define.ts` 170–178).
