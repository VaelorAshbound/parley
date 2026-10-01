# Cover page research, group B: DPA and BAA

Read-only research for Parley. No project files were changed.
Date: 2026-09-24. Tools: firecrawl CLI (search and scrape), repo files.

## Big finding first

**Common Paper's official cover pages for both documents are public.** They are
DOCX downloads that firecrawl can read. We have the exact wording of every
row, option and drafting note:

- DPA 1.1 cover page: https://commonpaper.com/standards/data-processing-agreement/1.1/cover-page-docx
- BAA 1.0 cover page: https://commonpaper.com/standards/business-associate-agreement/1.0/cover-page-docx

The DPA landing page also has an **annotated guide**: one note per cover page
row (what it means, what to pick, what is the default):
https://commonpaper.com/standards/data-processing-agreement/ (section "The DPA, annotated").
The BAA has no annotated guide online.

Both GitHub repos hold only the standard terms, no cover page:
https://github.com/CommonPaper/DPA, https://github.com/CommonPaper/BAA.

Common Paper's FAQ says anyone may change the cover page freely, as long as
the license line and the link to the Standard Terms stay
(https://commonpaper.com/standards/data-processing-agreement/, "Can I customize the Cover Page?").
So Parley can mirror the official rows closely, keep "Cover page by Parley,
not by Common Paper", and keep the CC BY 4.0 line.

**Option for the lead:** these two could use `source: "official"` like the NDA,
if we save the DOCX text as `templates/DPA-coverpage.md` and
`templates/BAA-coverpage.md`. That is a product decision (spec §1 says only
the NDA uses an official page). The proposals below mirror the official rows
either way.

## Parley model facts that shape the proposals

From `packages/documents/src/define.ts`, `fields.ts`, `render.ts`:

- A linked term can map to **several** field paths (`FieldPath | FieldPath[]`).
  Good for BAA `Limitations`.
- A section can hold `lines: [{ label, field }]`. Good for sub-rows.
- Linked terms render as the template's words, and the value shows on hover.
  So long values (like the Agreement name) never get pasted into the terms.
- Possessives ("Customer’s", "Company's") already fill from the base term.
- The build checks that every field is used. Cover-page-only fields (no linked
  term) are fine as long as a section shows them.
- Choice "Other" text is capped at 200 chars.
- Duration units render "days", not "calendar days".
- `spec.md` §2.4 already says choice should be "single or multiple". The code
  has only single today.

## Legal rule that applies to both documents

Both cover pages say: if the cover page leaves out a highlighted term, it means
"none" or "not applicable", **and the clause that uses it does not apply**.

- DPA intro (cover page DOCX above): "if the Cover Page omits or does not define
  a highlighted word, the default meaning will be “none” or “not applicable” and
  the correlating clause, sentence, or section does not apply to this DPA."
- BAA Standard Terms 6.1 (templates/BAA.md): same rule.

So a blank field can switch off a whole clause. Fields whose blank would break
the contract (or break HIPAA/GDPR rules) must be **required**. This is noted per
field below.

---

# 1. Data Processing Agreement (templates/DPA.md)

## Version

- The repo template matches **DPA Standard Terms 1.1**. Section 10 ("will start
  when Provider and Customer agree to a Cover Page … and sign or electronically
  accept the Agreement") is the 1.1 wording. The only change from 1.0 was
  "Corrects Section 10, Term of Agreement".
  Source: https://commonpaper.com/standards/data-processing-agreement/versions
- Current version is 1.1: https://commonpaper.com/standards/data-processing-agreement/

## How the template uses the linked terms

- **Customer / Provider** (73 / 74): the two parties. Customer is the Controller
  or a Processor. Provider is a Processor or a Subprocessor (1.1, 1.2).
- **Agreement** (9): the main contract this DPA adds to. It sets the liability
  cap (8.1), who can bring claims (8.2), order of control (9), and the DPA's
  term (10).
- **Categories of Personal Data, Categories of Data Subjects** (2 each): the
  Annex I(B) processing details (2.1). Provider may change them by notice when
  the Service changes (2.3).
- **Special Category Data, Special Category Data Restrictions or Safeguards,
  Frequency of Transfer, Nature and Purpose of Processing, Duration of
  Processing** (1 each): listed together in 2.3 (Provider may update them by
  notice). They are the SCC Annex I(B) fields.
- **Approved Subprocessors** (4): the list Customer approves up front (2.6(a)).
  Changes need 10 business days' notice; Customer has 30 days to object.
- **Governing Member State** (2): only in 3.2(c)(v)-(vi): the law of SCC
  Clause 17 (Option 1) and the courts of Clause 18(b). **EEA SCCs only.**
- **Security Policy** (2): the standard Provider is audited against (5.2), and
  the base of a "Report" (definition 11.13).
- **Provider Security Contact** (1): where written security questionnaires go,
  once a year (5.3).

## Where cover page values feed the SCCs and the UK Addendum

The standard terms point at the cover page for the SCC annexes:

- 2.1: "Annex I(B) on the Cover Page describes the subject matter, nature,
  purpose, and duration of this Processing".
- 3.2(c)(vii): "The Cover Page to this DPA contains the information required in
  Annex I, Annex II, and Annex III of the EEA SCCs."
- 3.3(a): "Section 3.2 of this DPA contains the information required in Table 2
  of the UK Addendum."
- 3.3(c): "The Cover Page contains the information required by Annex 1A,
  Annex 1B, Annex II, and Annex III of the UK Addendum."

**This means Parley's cover page must carry the full SCC annexes, not just the
14 linked terms.** Otherwise the SCCs are incorporated with empty annexes.
Needed rows that are not linked terms: Customer's role (Controller/Processor),
both parties' addresses and contact persons, the Service name, the supervisory
authority line, and Annex II security measures.

What the SCC annexes ask for (EU Decision 2021/914,
https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32021D0914):

| SCC slot | What it wants | Parley cover page source |
|---|---|---|
| Annex I.A exporter | Name, address, contact person's name, position and contact details, activities, signature and date, role (controller/processor) | `customer` party + `customerRole` |
| Annex I.A importer | Same | `provider` party; role fixed "Processor" |
| Annex I.B | Categories of data subjects | `dataSubjectCategories` |
| Annex I.B | Categories of personal data | `personalDataCategories` |
| Annex I.B | Sensitive data and restrictions or safeguards | `specialCategoryData` + `specialCategorySafeguards` |
| Annex I.B | Frequency of the transfer ("one-off or continuous") | `transferFrequency` |
| Annex I.B | Nature of the processing; purpose(s) | `processingNature` |
| Annex I.B | Retention period / duration | `processingDuration` |
| Annex I.C | Competent supervisory authority | fixed text |
| Annex II | Technical and organisational measures | `securityMeasures` |
| Annex III | List of sub-processors | `approvedSubprocessors` (Common Paper's annotation: "Annex III is covered by the list of Approved Subprocessors on the Cover Page") |
| Clause 17 Option 1 | "the law of one of the EU Member States, provided such law allows for third-party beneficiary rights … (specify Member State)" | `governingMemberState` |
| Clause 18(b) | "the courts of ___ (specify Member State)" | `governingMemberState` |

UK Addendum (ICO text; copy scraped from
https://www.contentstack.com/legal/international-data-transfer-addendum, which
reproduces the ICO's Part 2 Mandatory Clauses; official source is ico.org.uk):

- Default: the Addendum and the Addendum EU SCCs are "governed by the laws of
  England and Wales and … any dispute … resolved by the courts of England and
  Wales … unless the laws and/or courts of Scotland or Northern Ireland have
  been expressly selected by the Parties."
- "The Parties may agree to change Clauses 17 and/or 18 of the Addendum EU SCCs
  to refer to the laws and/or courts of Scotland or Northern Ireland."
- So the cover page "UK Transfers" choice (England and Wales / Scotland /
  Northern Ireland) is a real, valid slot. The linked term "Governing Member
  State" itself is only used for the EEA SCCs.

## Official cover page order (DPA 1.1 DOCX)

Source: https://commonpaper.com/standards/data-processing-agreement/1.1/cover-page-docx

1. USING THIS DPA (intro)
2. Key Terms: Agreement · Approved Subprocessors · Provider Security Contact · Security Policy
3. Changes to the Agreement (all optional): DPA Covered Claim · DPA Liability Cap · Governing Law and Chosen Courts · Service Provider Relationship
4. Restricted Transfers: Governing Member State
5. Annex I(A) List of Parties: Data Exporter · Data Importer
6. Annex I(B) Description of Transfer and Processing Activities: Service · Categories of Data Subjects · Categories of Personal Data · Special Category Data · Special Category Data Restrictions or Safeguards · Frequency of Transfer · Nature and Purpose of Processing · Duration of Processing
7. Annex I(C): Competent Supervisory Authority (fixed text)
8. Annex II: Technical and Organizational Security Measures
9. Closing line + signature table (PROVIDER, CUSTOMER: Signature, Print Name, Title, Date)
10. Footer: "Common Paper Data Processing Agreement (Version 1.1) free to use under CC BY 4.0."

The configuration guide on the landing page uses the same order (its nav:
"Key Terms, Approved Subprocessors, Changes to the Agreement, Restricted
Transfers, List of Parties, Transfer and Processing, Security Measures,
Signature Block").

Small differences between the web render and the DOCX (both official):

| Item | Web page | DOCX |
|---|---|---|
| Governing Member State, EEA line | "[ Select an EEA country ]" | "[ Select an EU Member State ]" |
| UK line | "[ Select England and Wales; Scotland; or Northern Ireland ]" | "[ Select Laws of England and Wales; Scotland; or Northern Ireland ]" |
| Subprocessor task | "Processing task" | "Anticipated Processing task" |
| Security Policy certification list | has "HITRUST" | has "HIPAA" in that slot |

Recommendation: follow the DOCX (it is the signed artifact), and the SCC text
(Clause 17 says "EU Member States").

## Proposed Parley cover page: DPA

Title: "Data Processing Agreement". Subtitle: "USING THIS DPA".
Label: "Cover page by Parley, not by Common Paper".

Intro (adapted from the official intro, version and URL kept):
"This DPA has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common
Paper DPA Standard Terms Version 1.1 posted at
commonpaper.com/standards/data-processing-agreement/1.1 ("DPA Standard Terms"),
which is incorporated by reference. If there is any inconsistency between the
parts of the DPA, the Cover Page will control over the DPA Standard Terms.
Capitalized and highlighted words have the meanings given on the Cover Page.
However, if the Cover Page omits or does not define a highlighted word, the
default meaning will be "none" or "not applicable" and the correlating clause,
sentence, or section does not apply to this DPA. All other capitalized words
have the meanings given in the DPA Standard Terms or the Agreement."

### Section A. Key Terms

Hint: "The key legal terms of the DPA."

**A1. Agreement** (heading "Agreement")
- key `agreement`, kind **text**, required, no default.
- label "Agreement". help: "The main contract this DPA adds to: its name, parties and date."
- Renders: "This DPA supplements the {value}." (official wording)
- Common Paper example: "Cloud Services Agreement between Company A, Inc. and Company B., Inc., dated [ effective date of agreement ]." (annotated guide)
- Linked term: `Agreement` → `agreement`.

**A2. Approved Subprocessors**
- key `approvedSubprocessors`, kind **choice**, required.
- label "Approved subprocessors". help: "Vendors Provider may use to process Customer's personal data."
- options:
  - `online`: "List of Subprocessors available at {value}" — nested **text** `subprocessorListUrl`, label "Subprocessor list URL", help "The web page that lists your subprocessors."
  - `listed`: "{value}" — nested **longText**, label "Subprocessors", help "For each: name, country of location, and anticipated Processing task."
- default: `{ option: "online" }` (official default is the URL option, pre-marked "x").
- Linked term: `Approved Subprocessors` → `approvedSubprocessors`.
- **Kind gap:** the official "listed" option is a repeating record
  (Subprocessor name / Country of location / Anticipated Processing task).
  Proper fit is a **list-of-records** kind. longText is the fallback.
- Nice to have: URL check on the text (no URL kind today).

**A3. Provider Security Contact**
- key `providerSecurityContact`, kind **text**, **required**.
- label "Provider security contact". help: "Email or postal address for security questions to Provider."
- Official: "[ email and/or physical address ]". Guide: "someone who is authorized to respond to customer requests related to your company's information security program."
- No default. (The AI can suggest the Provider party's email, but it is often a different inbox like security@.)
- Why required: if blank, clause 5.3 (security due diligence requests) has no channel and, by the intro rule, does not apply.
- Linked term: `Provider Security Contact` → `providerSecurityContact`.

**A4. Security Policy**
- key `securityPolicy`, kind **choice**, required.
- label "Security policy". help: "The security standard Provider follows and is audited against."
- options (exact official wording):
  - `agreement`: "As defined in the Agreement."
  - `reasonableEfforts`: "Provider will use commercially reasonable efforts to secure the Service from unauthorized access, alteration, or use and other unlawful tampering."
  - `online`: "Security Policy available at {value}" — nested **text**, label "Security policy URL".
  - `certifications`: "Provider will maintain annually updated reports or annual certifications of compliance with the following: {value}" — nested **text**, label "Reports or certifications", help "For example: SOC 2 Type II, ISO 27001."
- default: `{ option: "agreement" }` (official default, pre-marked "x").
- Linked term: `Security Policy` → `securityPolicy`.
- **Kind gap: multi-select.** Official note: "You should select at least one option, and can select more than one." The certifications line is itself a checklist: ISO 27001, SOC 2 Type I, SOC 2 Type II, HIPAA (DOCX; web shows HITRUST), Penetration testing, PCI Level 1, PCI Level 2, FedRAMP Authorized, Other: [fill in].
- **Judgment call:** 5.2 says Provider "is regularly audited against the standards defined in the Security Policy by independent third-party auditors". Picking only "commercially reasonable efforts" leaves no auditable standard, so 5.2 reads oddly. Warn when that option is picked alone.

### Section B. Changes to the Agreement (all optional)

Hint: "Optional. Leave empty to use the Agreement's own terms." (Official
drafting note: "If this DPA does not include a separate indemnity, liability
cap, or governing law from the Agreement, delete this entire section.")

None of these are linked terms. They are on the official page and the FAQ
highlights the CCPA row, so Parley should offer them. If scope is tight, B4 is
the one to keep; B1-B3 can wait.

**B1. DPA Covered Claim** — key `dpaCoveredClaim`, **choice**, optional, no default.
- label "DPA covered claim". help: "Extra indemnity from Provider for DPA breaches. Leave empty for none."
- options:
  - `commonPaperAgreement`: "The Agreement includes an additional Provider Covered Claim for any action, proceeding, or claim arising out of or relating to {value}" (official note: "select if using Common Paper CSA")
  - `otherAgreement`: "Without limiting the indemnity obligations in the Agreement, if any, Provider will indemnify, defend, and hold harmless Customer from and against any action, proceeding, or claim made by someone other than Customer, Customer’s Affiliates, or Users, and all out-of-pocket damages, awards, settlements, costs, and expenses, including reasonable attorneys’ fees and other legal expenses, that arise from {value}" (note: "select if not using Common Paper CSA")
  - nested **longText** "Covered claim", with the Committee default text: "(1) Provider’s breach or alleged breach of the DPA, or (2) Provider’s gross negligence or willful misconduct, in each case, that results in a Security Incident."
- **Model gap:** the nested value needs a default *when the option is picked*, while the field itself stays empty by default. Parley has no per-option nested default.

**B2. DPA Liability Cap** — key `dpaLiabilityCap`, optional.
- Official text: "…separate Increased Cap Amount of the greater of $[___] or [fill in a number greater than 1] times the fees paid or payable by Customer to Provider in the 12 month period immediately before the claim." Two variants (Common Paper CSA / other agreement, the second appended to Section 8.1).
- **Kind gap:** needs **two** nested values (money + a multiplier number > 1). Parley allows one nested field and has no plain number kind. Options: add a `number` kind and allow two nested fields, or defer this row.

**B3. Governing Law and Chosen Courts** — key `dpaGoverningState`, **choice**, optional, no default.
- one option `override`: "Notwithstanding the governing law or similar clauses of the Agreement, all interpretations and disputes about this DPA will be governed by the laws of the Governing State without regard to its conflict of laws provisions. In addition, and notwithstanding the forum selection, jurisdiction, or similar clauses of the Agreement, the parties agree to bring any legal suit, action, or proceeding about this DPA in, and each party irrevocably submits to the exclusive jurisdiction of, the courts of the Governing State. Governing State means: {value}" — nested **text**, label "Governing state", help "A state, province, or country."
- **Kind gap:** official asks for "a state, province, or country". Parley's `jurisdiction` is US-only and renders "courts located in X, ST", which is not this clause. Use text.
- Guide warns this is different from Governing Member State (which is only for the SCCs).

**B4. Service Provider Relationship (CCPA)** — key `ccpaServiceProvider`, **choice**, optional.
- label "Service provider relationship (CCPA)". help: "Say Provider is a CCPA service provider that won't sell data."
- options: `include`: the official paragraph, word for word ("To the extent California Consumer Privacy Act, Cal. Civ. Code § 1798.100 et seq (“CCPA”) applies, the parties acknowledge and agree that Provider is a service provider … Provider will notify Customer if it can no longer meet its obligations under the CCPA."); `exclude`: "Not included."
- default: `{ option: "exclude" }`.
- **Kind gap (small):** this is a checkbox. A two-option choice works.
- **Judgment call:** guide says "If CCPA does not apply, or if you do not qualify as a service provider, delete the entire row." Provider must truly meet every statement. The AI should ask, not assume.

### Section C. Restricted Transfers

Hint: "Which laws and courts govern the EU and UK transfer clauses."

**C1. Governing Member State** — heading "Governing Member State", two `lines`:

- Line "EEA Transfers": key `governingMemberState`, kind **choice**, **required**, no default.
  - label "Governing member state (EEA)". help: "EU country whose law and courts govern the EU transfer clauses."
  - options: the 27 EU Member States, label = country name: Austria, Belgium, Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden.
  - Linked term: `Governing Member State` → `governingMemberState`.
- Line "UK Transfers": key `ukGoverningLaw`, kind **choice**, optional.
  - label "UK transfers". help: "UK law and courts for the UK transfer addendum."
  - options: `englandWales` "Laws of England and Wales", `scotland` "Laws of Scotland", `northernIreland` "Laws of Northern Ireland".
  - default: `{ option: "englandWales" }` (matches the UK Addendum's own default).

- **Kind gap:** no country kind. A 27-option choice works, but the UI must render it as a searchable select, not 27 radios.
- **Judgment calls (GDPR):**
  - EU vs EEA list: the web page says "EEA country" (30, adds Iceland, Liechtenstein, Norway); the DOCX says "EU Member State"; SCC Clause 17 Option 1 says "one of the EU Member States". Recommend EU-27.
  - Clause 17 requires a law that "allows for third-party beneficiary rights". Parley should not pick one silently. No default; the AI can suggest the exporter's own country (Clause 18 option 2 logic) or a common pick like Ireland, and say why.
  - Required or not: if the DPA has no EEA-origin transfers, the SCCs never trigger. But a blank switches off 3.2(c)(v)-(vi) and leaves Clause 17/18 unfilled. Safer: required.

### Section D. Annex I(A) List of Parties

Hint: "Who sends and who receives the personal data."

**D1. Data Exporter** = `customer` (**party**). Shown as lines:
- "Name: {customer.company}" · "Address: {customer.address}" · "Contact Person: {customer.name}, {customer.title}, {customer.email}" · "Activities relevant to transfer: See Annex 1(B)" (fixed) · "Role: {customerRole}".
- `customer` party: label "Customer", help "The company whose personal data Provider processes."
- `customerRole`: kind **choice**, required. label "Customer's role". help: "Controller if it owns the data; Processor if it handles it for someone."
  - options: `controller` "Controller", `processor` "Processor".
  - default `{ option: "controller" }`.
  - This decides SCC Module Two (Controller) vs Module Three (Processor) (3.2(a)-(b)), and whether Provider is a Processor or Subprocessor (1.1, 1.2).
- Linked term: `Customer` → `customer.company`.

**D2. Data Importer** = `provider` (**party**). Same lines; "Role: Processor" is fixed text.
- guide: "the Provider is always identified as a Processor. However, Section 1.2 … deems that designation to be that of 'Subprocessor' if the Customer’s role above is that of a Processor."
- `provider` party: label "Provider", help "The company providing the Service and processing the data."
- Linked term: `Provider` → `provider.company`.

- **Judgment call:** the official page has a separate contact person (name, position, address) from the signer. Parley's party has one person. Using the signer as the Annex I(A) contact is common, but some customers want their DPO here. Accept for v1, and say it in the field help. If needed later, add an optional `dataProtectionContact` text per party.
- Rule: Customer and Provider must be different companies (as in the NDA).

### Section E. Annex I(B) Description of Transfer and Processing Activities

Hint: "What data is processed, whose, how often, and why." Add a note from 2.3:
"Provider may update these details by notice when the Service changes."

**E1. Service** — key `service`, **text**, required. label "Service". help: "The name of the product or service Provider gives Customer." Official: "[ Name of product or service ]". Not a linked term.

**E2. Categories of Data Subjects** — key `dataSubjectCategories`, required.
- label "Categories of data subjects". help: "Whose personal data Provider processes."
- options (official): "Customer’s end users or customers", "Customer’s employees", plus custom.
- default: "Customer’s end users or customers".
- **Kind gap: multi-select with Other.** Official: "check all that apply"; guide: "You must select at least one option."
- Guide tip for Processor customers: custom "End users of a Controller on whose behalf Customer processes data."
- Linked term: `Categories of Data Subjects` → `dataSubjectCategories`.

**E3. Categories of Personal Data** — key `personalDataCategories`, required.
- label "Categories of personal data". help: "What kinds of personal data Provider processes."
- options (official, exact):
  - "Name"
  - "Contact information such as email, phone number, or address"
  - "Employment information such as employee ID or compensation"
  - "Financial information such as bank account numbers"
  - "Professional or biographic information such as resume or CV"
  - "Transactional information such as account information or purchases"
  - "User activity and analysis such as device information or IP address"
  - "Location information"
  - custom
- default: Name + Contact information (Parley's pick; Common Paper pre-checks nothing).
- **Kind gap: multi-select with Other.**
- Linked term: `Categories of Personal Data` → `personalDataCategories`.

**E4. Special Category Data** — key `specialCategoryData`, **choice**, required.
- heading "Special Category Data", hint "Is special category data Processed?" (official).
- label "Special category data". help: "Health, race, religion, biometrics and similar extra-sensitive data."
- options: `yes` "Yes", `no` "No". default `{ option: "no" }`.
- Linked term: `Special Category Data` → `specialCategoryData`.
- **GDPR judgment call:** GDPR Article 9 data. Default "No" is right for most SaaS, but a wrong "No" is a real compliance risk. The AI must ask, not assume, when the Service touches health, HR, biometric or similar data.

**E5. Special Category Data Restrictions or Safeguards** — key `specialCategorySafeguards`, **choice**, optional; required when E4 = Yes.
- label "Special category safeguards". help: "Extra protections for sensitive data, like access limits or encryption."
- options: `securityPolicy` "See Security Policy", `custom` "{value}" nested **longText** (help: "For example: strict purpose limits, access logs, limits on onward transfers.").
- no default.
- Official note: "If “No” is selected above, delete this entire row."
- Rules: E4 = yes → E5 required; E4 = no → E5 must be empty and hidden.
- **Model gap:** conditional visibility. `rules()` can enforce it, but the UI should hide the row.
- Linked term: `Special Category Data Restrictions or Safeguards` → `specialCategorySafeguards`.

**E6. Frequency of Transfer** — key `transferFrequency`, **choice**, required, `allowOther: true`.
- label "Frequency of transfer". help: "How often Customer sends personal data to Provider."
- options: `continuous` "Continuous". Other = custom (e.g. "One-off transfer").
- default `{ option: "continuous" }` (guide: "“Continuous” is the typical choice for online service providers.").
- Linked term: `Frequency of Transfer` → `transferFrequency`.

**E7. Nature and Purpose of Processing** — key `processingNature`, required.
- Fixed lead-in (official): "Provider will Process Customer Personal Data as instructed in Section 2.3 of the DPA Standard Terms. The nature of processing includes:"
- label "Nature of processing". help: "What Provider does with the data."
- options (official, exact):
  - "Receiving data, including collection, accessing, retrieval, recording, and data entry"
  - "Holding data, including storage, organization, and structuring"
  - "Using data, including analysis, consultation, testing, automated decision making, and profiling"
  - "Updating data, including correcting, adaptation, alteration, alignment, and combination"
  - "Protecting data, including restricting, encrypting, and security testing"
  - "Sharing data, including disclosure, dissemination, allowing access, or otherwise making available"
  - "Returning data to the data exporter or data subject"
  - "Erasing data, including destruction and deletion"
  - custom
- default: Receiving, Holding, Protecting, Erasing (Parley's pick for a typical hosted service; flag). Or no default.
- **Kind gap: multi-select with Other.**
- Note: the official lead-in cites "Section 2.3", while Duration cites "Section 2.2(a)-(d)" (the instructions clause). Keep Common Paper's words as-is; do not "fix" them.
- Linked term: `Nature and Purpose of Processing` → `processingNature`.

**E8. Duration of Processing** — key `processingDuration`.
- Official fixed text: "Provider will process Customer Personal Data as long as required (i) to conduct the Processing activities instructed in Section 2.2(a)-(d) of the Standard Terms; or (ii) by Applicable Laws."
- Guide: "This language is not intended to be modified."
- **Model gap:** a linked term whose value is fixed text. Parley needs a field for every linked term. Two options:
  1. Add a "fixed" cover-page value that a linked term can map to (cleanest).
  2. Workaround: a **choice** with one option (the text above), default set, no Other.
- Linked term: `Duration of Processing` → `processingDuration`.

### Section F. Annex I(C)

**Competent Supervisory Authority** — fixed text, no field:
"The supervisory authority will be the supervisory authority of the data exporter, as determined in accordance with Clause 13 of the EEA SCCs or the relevant provision of the UK Addendum."

### Section G. Annex II

**Technical and Organizational Security Measures** — key `securityMeasures`, **choice**, required. Not a linked term.
- label "Security measures". help: "How Provider keeps the data safe (SCC Annex II)."
- options: `securityPolicy` "See Security Policy"; `described` "{value}" nested **longText** (help lists the official topics).
- default `{ option: "securityPolicy" }` (official default "x").
- **Kind gap:** the official row is a checklist of 17 topics, each with its own paragraph: pseudonymization and encryption; ongoing confidentiality, integrity, availability and resilience; restoring availability after an incident; regular testing; user identification and authorization; data in transit; data at rest; physical security; events logging; systems configuration; IT security governance; certification or assurance; data minimization; data quality; limited data retention; accountability; data portability and erasure. Proper fit is a **checklist with text per item**. 2000 chars total is tight for this.
- **GDPR judgment call:** "See Security Policy" only works if the Security Policy (A4) points to a real document. If A4 = "As defined in the Agreement" and the Agreement has no security terms, Annex II is empty. Warn on that combo. For Module Three (Customer is a Processor) the SCCs also ask for measures to assist the controller.

### Closing, signatures, footer

- Closing (official): "Provider and Customer have not changed the DPA Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this DPA as of the last date of signature below."
- Signatures: `["provider", "customer"]`. Official rows: Signature, Print Name, Title, Date. (No notice address row; addresses live in Annex I(A).)
- Footer: "Common Paper Data Processing Agreement (Version 1.1) free to use under CC BY 4.0." + "Cover page by Parley, not by Common Paper".
- No effective date field: the DPA starts per Section 10.

### DPA linked term map

| Term | Field path |
|---|---|
| Customer | `customer.company` |
| Provider | `provider.company` |
| Agreement | `agreement` |
| Categories of Personal Data | `personalDataCategories` |
| Categories of Data Subjects | `dataSubjectCategories` |
| Special Category Data | `specialCategoryData` |
| Special Category Data Restrictions or Safeguards | `specialCategorySafeguards` |
| Frequency of Transfer | `transferFrequency` |
| Nature and Purpose of Processing | `processingNature` |
| Duration of Processing | `processingDuration` |
| Approved Subprocessors | `approvedSubprocessors` |
| Governing Member State | `governingMemberState` |
| Security Policy | `securityPolicy` |
| Provider Security Contact | `providerSecurityContact` |

Cover-page-only fields: `customerRole`, `ukGoverningLaw`, `service`, `securityMeasures`, and optional `dpaCoveredClaim`, `dpaLiabilityCap`, `dpaGoverningState`, `ccpaServiceProvider`.

---

# 2. Business Associate Agreement (templates/BAA.md)

## Version

BAA Standard Terms **1.0**, released July 7, 2023. It is the only version.
The template's own definition 6.3 names it.
Sources: https://commonpaper.com/standards/business-associate-agreement/1.0/,
https://commonpaper.com/standards/business-associate-agreement/ ("Current version: 1.0").

## How the template uses the linked terms

- **Provider** (58): the Business Associate (or its subcontractor). Owes all the Section 1 duties.
- **Company** (26): the Covered Entity (or the Business Associate, when Provider is its subcontractor).
- **Agreement** (3): the main contract. Its end ends the BAA (5.1); a material breach of the BAA is a breach of the Agreement (5.2); Services are defined by it (6.16).
- **Limitations** (5): limits on four activities the terms otherwise allow: subcontracting (1.7), offshoring PHI outside the US (3.1), de-identifying PHI (3.2), aggregating PHI "for its own purposes" (3.3). Each clause says "Except as restricted by applicable Limitations". Definition 6.18 uses it as the example Variable.
- **Breach Notification Period** (1): how fast Provider reports improper uses or disclosures, breaches of unsecured PHI (§164.410) and Security Incidents (4.1).
- **BAA Effective Date** (1): when the BAA starts (5.1).
- 6.1: a Variable the cover page leaves out means "none"/"not applicable" and **its clause does not apply**.

## Official cover page (BAA 1.0 DOCX)

Source: https://commonpaper.com/standards/business-associate-agreement/1.0/cover-page-docx

Order and exact text:

1. **USING THIS BAA**: "This BAA has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common Paper BAA Standard Terms Version 1.0 posted at https://commonpaper.com/standards/business-associate-agreement/1.0, which is incorporated by reference. Any modifications to the BAA Standard Terms should be made on the Cover Page. If there is any inconsistency between the parts of the BAA, the Cover Page will control over the BAA Standard Terms. Capitalized words have the meanings or descriptions given in the Cover Page or Standard Terms."
2. **Key Terms**: "The key legal terms of this BAA are as follows:"
3. **Agreement**: "This BAA is incorporated into the [ insert principal agreement ]"
4. **Relationship**: "Provider is a [ subcontractor | Business Associate ]" / "Company is a [ Business Associate | Covered Entity ]"
5. **Breach Notification Period**: drafting note "this time period cannot be more than 60 calendar days"; "[ # ] [ hours | business days | calendar days ] from discovery"
6. **Designated Record Set**: "( ) Provider maintains PHI in a Designated Record Set." / "( ) Provider does not maintain PHI in a Designated Record Set."
7. **Limitations**: drafting note "The Standard Terms permit all four activities (Sections 1.7 and 3). Delete the entire section to allow these activities as specified in the Standard Terms. To prohibit or place limits on the extent to which these activities can be done, select and specify those that apply." Then Subcontracting, Offshoring, De-identification, Aggregation (wording below).
8. **BAA Effective Date** — hint "The date the BAA starts": "[ x ] Date of last signature on this Cover Page" / "[ ] [Fill in custom Effective Date]"
9. **Changes to BAA Standard Terms** → **Other Changes to BAA Standard Terms** — hint "Additional modifications or customizations": "[Fill in]"
10. Closing: "Provider and Company have not changed the BAA Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this BAA as of the BAA Effective Date."
11. Signature table: PROVIDER / COMPANY: Signature, Print Name, Title, Notice Address ("Use email or postal address"), Date.
12. Footer: "Common Paper Business Associate Agreement (Version 1.0) free to use under CC BY 4.0."

The configuration guide variables (landing page, "Show variables") confirm the
same structure: `business_associate_relationship_type`,
`breach_notification_val` + `breach_notification_unit`,
`designated_record_set_provider_maintains`, and for each of subcontract /
offshore / deidentification / aggregation an "include", a "permitted" and a
"sublimits"/text value. Source: https://commonpaper.com/standards/business-associate-agreement/

## Proposed Parley cover page: BAA

Title "Business Associate Agreement". Subtitle "USING THIS BAA". Intro: the
official paragraph above. Label "Cover page by Parley, not by Common Paper".

### Section: Key Terms (hint "The key legal terms of this BAA.")

**1. Agreement** — key `agreement`, **text**, required, no default.
- label "Agreement". help: "The main contract this BAA is part of."
- Renders: "This BAA is incorporated into the {value}" (official).
- Required: 5.1 ties the BAA's end to the Agreement's end.
- Linked term: `Agreement` → `agreement`.

**2. Relationship** — key `relationship`, **choice**, required. Not a linked term.
- label "Relationship". help: "Each party's role under HIPAA."
- options (official words, combined into the two valid pairs):
  - `businessAssociate`: "Provider is a Business Associate. Company is a Covered Entity."
  - `subcontractor`: "Provider is a subcontractor. Company is a Business Associate."
- default `{ option: "businessAssociate" }` (the usual case: a vendor serving a covered entity, per the landing page FAQ "What is a Business Associate Agreement?").
- **HIPAA judgment call:** the official page has two separate pickers, so it allows odd pairs like "Provider is a subcontractor, Company is a Covered Entity". Under HIPAA a subcontractor works for a Business Associate, not straight for a Covered Entity. Parley's one choice with the two valid pairs is simpler and safer. A lawyer should confirm.

**3. Breach Notification Period** — key `breachNotificationPeriod`, required.
- label "Breach notification period". help: "How fast Provider must report a breach. 60 calendar days at most."
- Renders: "{value} from discovery" (official).
- Recommended shape: **choice** with one option `fromDiscovery`: "{value} from discovery", nested **duration**. Or a plain duration field if the cover section can add the " from discovery" suffix.
- default: `{ amount: 5, unit: "businessDays" }` — **Parley's pick, not Common Paper's** (it has no default). Market BAAs commonly use a few business days; flag for review. Shorter periods help Company meet its own 60-day duty to individuals.
- Linked term: `Breach Notification Period` → `breachNotificationPeriod`.
- **Kind gaps:**
  - Official units are "hours | business days | calendar days". Parley's "days" unit prints "days", not "calendar days". Add a `calendarDays` unit, or a per-field unit list + label.
  - Weeks, months and years should not be offered here.
  - Needs a max: "cannot be more than 60 calendar days". Rule: hours ≤ 1440; calendar days ≤ 60; business days ≤ 42 (a safe bound under 60 calendar days).
- **HIPAA basis:** 45 CFR §164.410(b): "without unreasonable delay and in no case later than 60 calendar days after discovery of a breach." Source: https://www.law.cornell.edu/cfr/text/45/164.410
- Why required: if blank, 4.1 (breach reporting) does not apply under 6.1, and a BAA without breach reporting fails 45 CFR §164.504(e)(2)(ii)(C).

**4. Designated Record Set** — key `designatedRecordSet`, **choice**, required. Not a linked term.
- label "Designated record set". help: "Does Provider keep PHI records the patient can ask to see or fix?"
- options (official): `maintains` "Provider maintains PHI in a Designated Record Set." / `doesNotMaintain` "Provider does not maintain PHI in a Designated Record Set."
- no default (official note: "select one and delete the other").
- **HIPAA judgment call:** this decides whether the access and amendment duties in 1.10 (45 CFR §164.524, §164.526) really bite. Most SaaS vendors pick "does not maintain", but it depends on the product. The AI should ask.

**5. Limitations** — heading "Limitations", four `lines`, each a **choice**, required, default "no limit".
Hint (from the official note, plain words): "The Standard Terms allow all four. Pick a limit only where you need one."
Linked term: `Limitations` → `["limitSubcontracting", "limitOffshoring", "limitDeidentification", "limitAggregation"]`.

Why an explicit "no limit" option: the official way to allow an activity is to
delete the row. In Parley an empty field shows as a placeholder, which looks
unfinished. The "no limit" label is Parley's wording, built from the template's
own section numbers.

- `limitSubcontracting`, line "Subcontracting". help: "Can Provider share PHI with its own vendors?"
  - `permitted`: "No limitation. Section 1.7 of the BAA Standard Terms applies." (default)
  - `never`: "Provider will not subcontract."
  - `unlessNotice`: "Provider will not subcontract unless notice has been provided to Company as specified here: {value}" — nested **longText**
  - `unlessPermission`: "Provider will not subcontract unless with Company’s explicit permission as specified here: {value}" — nested **longText**
- `limitOffshoring`, line "Offshoring". help: "Can Provider use or send PHI outside the United States?"
  - `permitted`: "No limitation. Section 3.1 of the BAA Standard Terms applies." (default)
  - `never`: "Offshoring of PHI and/or Services is not permitted."
  - `unless`: "Offshoring of PHI and/or Services not permitted unless {value}" — nested **longText**
- `limitDeidentification`, line "De-identification". help: "Can Provider strip identifiers from PHI?"
  - `permitted`: "No limitation. Section 3.2 of the BAA Standard Terms applies." (default)
  - `never`: "Provider will not de-identify PHI."
  - `unlessPurpose`: "Provider will not de-identify PHI unless doing so for the specific purpose of {value}" — nested **text**, help (official example): "Such as “generating data analytics for academic research”."
  - `unlessRequirements`: "Provider will not de-identify PHI unless the following additional requirements for de-identifying PHI have been implemented: {value}" — nested **longText**
- `limitAggregation`, line "Aggregation". help: "Can Provider combine PHI for its own purposes?"
  - `permitted`: "No limitation. Section 3.3 of the BAA Standard Terms applies." (default)
  - `never`: "Provider will not aggregate PHI."
  - `unless`: "Provider will not aggregate PHI unless {value}" — nested **longText**

Kind note: the official Subcontracting and De-identification "unless" rows are
checkboxes, so both conditions can be ticked. Parley's single choice splits
them into two options. Ticking both is rare; if needed, a multi-select or
"Other" (only 200 chars) covers it.

**HIPAA judgment calls on Limitations:**
- Defaults: "no limit" matches the Standard Terms, which "permit all four activities". It favors Provider. Covered entities often restrict offshoring and aggregation. The AI should mention this, not change it silently.
- Aggregation "for its own purposes" (3.3) is wider than HIPAA's "data aggregation services", which are allowed for the covered entity's health care operations (45 CFR §164.504(e)(2)(i)(B)). A lawyer should review this default.
- De-identification must meet 45 CFR §164.514(a)-(b) to leave HIPAA.

**6. BAA Effective Date** — key `effectiveDate`, **choice**, required.
- hint (official) "The date the BAA starts".
- label "BAA effective date". help: "The day the BAA starts."
- options: `lastSignature` "Date of last signature on this Cover Page" (default, official "x"); `custom` "{value}" nested **date**, label "Custom effective date".
- default `{ option: "lastSignature" }`.
- Linked term: `BAA Effective Date` → `effectiveDate`.
- Why required: if blank, 5.1 has no start.

### Section: Changes to BAA Standard Terms

**7. Other Changes to BAA Standard Terms** — key `modifications`, **longText**, optional.
- hint (official) "Additional modifications or customizations".
- label "Other changes". help: "List any changes to the BAA Standard Terms."

### Closing, signatures, footer

- Closing: official text (item 10 above).
- Signatures: `["provider", "company"]`. Official rows: Signature, Print Name, Title, Notice Address ("Use email or postal address"), Date. Parley's party (company, name, title, email, address) covers these.
- `provider` party: label "Provider", help "The vendor that handles PHI for Company."
- `company` party: label "Company", help "The covered entity (or business associate) sharing PHI."
- Rule: Provider and Company must be different companies.
- Footer: "Common Paper Business Associate Agreement (Version 1.0) free to use under CC BY 4.0." + "Cover page by Parley, not by Common Paper".

### BAA linked term map

| Term | Field path |
|---|---|
| Provider | `provider.company` |
| Company | `company.company` |
| Agreement | `agreement` |
| Limitations | `limitSubcontracting`, `limitOffshoring`, `limitDeidentification`, `limitAggregation` |
| Breach Notification Period | `breachNotificationPeriod` |
| BAA Effective Date | `effectiveDate` |

Cover-page-only fields: `relationship`, `designatedRecordSet`, `modifications`.

---

# 3. Kinds and model features Parley lacks

| Need | Where | Why | Workaround today |
|---|---|---|---|
| **Multi-select with Other** | DPA: Categories of Data Subjects, Categories of Personal Data, Nature and Purpose of Processing, Security Policy (+ its certifications list) | Official rows are "check all that apply"; guide says "select at least one, can select more than one". SCC Annex I.B lists several categories. Spec §2.4 already promises "single or multiple". | longText with the official options in help (loses structure and exact wording) |
| **List of records** | DPA Approved Subprocessors ("listed" option) | Each subprocessor has name, country, anticipated task | longText |
| **Checklist with text per item** | DPA Annex II security measures (17 topics) | Each ticked topic has its own paragraph | one longText (2000 chars is tight) |
| **Fixed value for a linked term** | DPA Duration of Processing | Official text "is not intended to be modified" | one-option choice with default |
| **Two nested values / number kind** | DPA Liability Cap (money + multiplier > 1) | One clause, two blanks | defer the row |
| **Per-option nested default** | DPA Covered Claim | Committee default text should appear only when the option is picked | put the default text in help |
| **Conditional field** | DPA Special Category safeguards (only if Yes) | Official: delete the row when "No" | `rules()` + UI hide |
| **Calendar days unit + per-field max / unit list** | BAA Breach Notification Period | Official units hours / business days / calendar days; ≤ 60 calendar days | `rules()` for max; "days" label is wrong |
| **Non-US place** | DPA Governing State ("state, province, or country") | `jurisdiction` is US-only and renders "courts located in" | text |
| **Country list UI** | DPA Governing Member State (27 EU states) | Long single-select | choice works; needs a searchable select |
| Boolean | DPA CCPA row | A checkbox | two-option choice |
| URL check | DPA subprocessor list URL, Security Policy URL | Must be a link | text |

# 4. Biggest judgment calls (need a human or lawyer)

1. **DPA must carry the SCC annexes.** The standard terms say the cover page holds Annex I, II, III info (3.2(c)(vii), 3.3(c)). So Parley needs non-linked rows (Customer role, addresses, contacts, Service, Annex I(C), Annex II). Leaving them out breaks the SCCs.
2. **Governing Member State:** EU-27 (DOCX, SCC Clause 17) vs EEA-30 (web page). Recommend EU-27, no default. Law must allow third-party beneficiary rights.
3. **Special Category Data default "No"** and **Annex II "See Security Policy"**: fine for most SaaS, risky if wrong. The AI should ask.
4. **Security Policy single vs multi.** "Commercially reasonable efforts" alone leaves 5.2 audits with no standard.
5. **Contact person = signer** in Annex I(A). Common, but some want a DPO.
6. **Changes to the Agreement rows** (indemnity, super cap, DPA governing law, CCPA): official but optional; B2 needs new kinds. CCPA row must be true for Provider.
7. **BAA Breach Notification default** (5 business days is Parley's pick, not Common Paper's). HHS cap 60 calendar days.
8. **BAA Limitations default "no limit"** favors Provider; aggregation "for its own purposes" is wider than HIPAA data aggregation. Lawyer review.
9. **BAA Relationship** folded into two valid pairs; **Designated Record Set** has no default.
10. **Blank = clause off** (DPA intro, BAA 6.1): keep Provider Security Contact, Breach Notification Period, BAA Effective Date, Agreement required.

# 5. Sources

- DPA landing page, official cover page render, annotated guide, config guide variables, FAQ: https://commonpaper.com/standards/data-processing-agreement/
- DPA 1.1 cover page (DOCX): https://commonpaper.com/standards/data-processing-agreement/1.1/cover-page-docx
- DPA 1.1 Standard Terms: https://commonpaper.com/standards/data-processing-agreement/1.1/
- DPA version history: https://commonpaper.com/standards/data-processing-agreement/versions
- DPA GitHub (terms only): https://github.com/CommonPaper/DPA
- BAA landing page, FAQ, config guide variables: https://commonpaper.com/standards/business-associate-agreement/
- BAA 1.0 Standard Terms: https://commonpaper.com/standards/business-associate-agreement/1.0/
- BAA 1.0 cover page (DOCX): https://commonpaper.com/standards/business-associate-agreement/1.0/cover-page-docx
- BAA GitHub (terms only): https://github.com/CommonPaper/BAA
- EU SCCs, Decision 2021/914 (Clauses 17, 18, Annex I): https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32021D0914
- UK Addendum text (ICO Part 2 Mandatory Clauses, as reproduced): https://www.contentstack.com/legal/international-data-transfer-addendum
- HIPAA 45 CFR §164.410 (60 calendar days): https://www.law.cornell.edu/cfr/text/45/164.410
- Repo: templates/DPA.md, templates/BAA.md, packages/documents/src/{fields,define,render}.ts, work/PAR-1/spec.md

Scraped copies (for re-checking) are in the scratchpad `fc/` folder:
`fc/dpa-cover.md`, `fc/baa-cover.md`, `fc/.firecrawl/*.md`, `fc/scc.md`,
`fc/uk-add.json`, `fc/hipaa410.md`.
