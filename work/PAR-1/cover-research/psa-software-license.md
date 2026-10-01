# Cover page research D: PSA and Software License Agreement

Group D: `templates/psa.md` (Professional Services Agreement) and
`templates/Software-License-Agreement.md` (Software License Agreement, "SLA-sw" below
so it is not mixed up with the Service Level Agreement).

Research date: 2026-09-24. All web pages were fetched with the firecrawl CLI.

## 0. Summary

- **Common Paper's own cover pages ARE public.** Both official cover pages (SOW + Key Terms for
  the PSA; Order Form + Key Terms for the Software License) are printed in full on the
  standard's web page, with an annotated guide for every row. So every field below mirrors the
  official row, its order, its short hint and its option wording. Sources:
  - PSA: https://commonpaper.com/standards/professional-services-agreement/ (cover page,
    "The PSA, annotated")
  - SOW as a stand-alone doc: https://commonpaper.com/documents/statement-of-work/ and its
    Google Doc export https://docs.google.com/document/d/1Y8B6IwpXeoHrWNNteyeKdU72_b0b9hOIB5i0TgbsB3w
    (has "Drafting note" text per row)
  - Software License: https://commonpaper.com/standards/software-license-agreement/ (cover page
    and annotations; Version 1.1)
  - Help Center, one article per variable: PSA collection
    https://help.commonpaper.com/en/collections/3813458-professional-services-agreements-psa ;
    Software License collection
    https://help.commonpaper.com/en/collections/10317329-software-license-agreement
  - GitHub (standard terms only, no cover page): https://github.com/CommonPaper/PSA ,
    https://github.com/CommonPaper/Software-License-Agreement
- **Kinds Parley lacks** (details in section 3):
  1. **Multi-select choice** (with "Other"). Needed for Increased Claims, Unlimited Claims
     (both docs), Deletion Procedure, Security Policy certifications. The PAR-1 spec already
     promises "choice (single or multiple)" (spec.md §2 item 4), but `fields.ts` only has single.
  2. **A number / multiplier** ("[N]x the fees…") for the cap amounts.
  3. **Several placeholders in one choice option** ("The greater of $[amount] or [N]x the
     fees…" needs money + multiplier). Today an option nests ONE field.
  4. Nice to have, not required: a checkbox (a one-option optional choice works for now), a
     suffix on a cover line ("10 days *from Deliverable submission*"), and a choice default
     that picks an option without a number (`default` is typed as a complete value today).
- **Biggest judgment calls** (section 4): the "Using this agreement" intro text that makes the
  cover page legally work; one signature block for SOW/Order Form + Key Terms; which
  non-linked but load-bearing rows to include (Services, Software, Fees, SOW Date, Invoice
  Period, Third-Party Materials); required vs optional General Cap Amount; defaults where
  Common Paper gives none; the US-only jurisdiction field; Common Paper's cover page and Help
  Center disagreeing on some Software License defaults (J13, J14).
- The repo's `psa.md` is PSA **Version 1.1** (only change from 1.0 is "Discloser" in §11.3,
  which the repo has). `Software-License-Agreement.md` names Version 1.1 itself (§11.30).

---

## 1. Professional Services Agreement (`psa`)

### 1.1 How the official cover page is built

Source: https://commonpaper.com/standards/professional-services-agreement/ (section
"Professional Services Agreement" → "SOW", "USING THIS AGREEMENT", "Key Terms").

Official order of rows:

**SOW** ("The key business terms of this SOW are as follows:")
1. SOW and Agreement ("This SOW [XX] incorporates the Agreement with the Key Terms below…")
2. Services
3. Deliverables (+ 3 optional checkboxes: in-progress drafts; attached specifications;
   acceptance process with Rejection Period / Resubmission Period)
4. Time of Assignment
5. Third-Party Materials
6. Fees (+ optional travel and expenses)
7. Payment Period — "Time frame for Customer to pay invoices"
8. Invoice Period — "How frequently Provider sends invoices"
9. SOW Date — "The date this SOW begins"
10. SOW Term — "How long this SOW lasts"
11. Customer Obligations
12. Other Changes to Standard Terms — "Changes that apply for this SOW only"
13. Signature block (SOW)

**USING THIS AGREEMENT** paragraph, then **Key Terms** ("The key legal terms of this
Agreement are as follows:")
1. Effective Date — "The date the Agreement starts"
2. Governing Law
3. Chosen Courts — "Jurisdiction or where disputes are filed"
4. Covered Claims — "Claims covered by indemnity obligations"
5. General Cap Amount — "Limitation of liability amount for most claims"
6. Increased Claims — "Specific claims covered by the Increased Cap Amount"
7. Increased Cap Amount — "Higher limitation of liability amount for Increased Claims, often
   called a supercap"
8. Unlimited Claims — "Claims excluded from any liability cap"
9. Additional Warranties
10. Insurance Minimums — "Requirements for Provider's or Customer's policies"
11. Attachments and Supplements: DPA ("Data Processing Agreement"), Customer Policies,
    Security Policy
12. Changes to Standard Terms: Publicity Rights ("Modifying Section 12.7 of the Standard
    Terms"), Other Changes to Standard Terms ("Changes that apply to the Agreement and all SOWs")
13. Closing: "**Provider** and **Customer** have not changed the Standard Terms except for the
    details on the Cover Page above. By signing this Cover Page, each party agrees to enter
    into this Agreement as of the **Effective Date**."
14. Signature block: PROVIDER / CUSTOMER — Signature, Print Name, Title, Notice Address ("Use
    email or postal address"), Date.

Official marks: `( )` = pick exactly one; `[ ]` = pick none, one or more; `x` = default.
Source: SOW Google Doc "Interpreting help text"; SLA-sw annotations "( x )".

Help Center defaults (PSA collection):
- General Cap Amount default: "1x the fees paid or payable by Customer to Provider in the 12
  month period immediately before the claim" —
  https://help.commonpaper.com/en/articles/6901520-general-cap-amount
- Increased Cap Amount default: "5x the fees paid or payable…"; Increased and Unlimited Claims
  "The default is to not include these"; "You can select something as an Increased Claim or
  an Unlimited Claim, but not both." —
  https://help.commonpaper.com/en/articles/6901510-increased-and-unlimited-claims-optional
- Payment Period default: "30 days from the customer's receipt of invoice" —
  https://help.commonpaper.com/en/articles/7211826-payment-period
- SOW Term default: "The engagement lasts until all Deliverables and Fees have been
  exchanged, and any acceptance processes are complete." —
  https://help.commonpaper.com/en/articles/7211834-sow-term
- Time of Assignment: "optional variable but should be used if the agreement includes
  Deliverables" — https://help.commonpaper.com/en/articles/7211383-time-of-assignment
- Acceptance: "Check the box to include an acceptance process. Set a time period for
  rejection… Set a time period for resubmission." —
  https://help.commonpaper.com/en/articles/7211376-deliverables-acceptance-process
- Customer Obligations / Customer Policies / DPA / Security Policy / Insurance Minimums /
  Additional Warranties: all "optional variable" — articles 7211838, 7211840, 6901494,
  6901492, 6901502, 6901505 (same Help Center collection).

### 1.2 How the template uses each linked term

| Term | Where | What it needs |
|---|---|---|
| Customer, Provider | everywhere; §13.6 "Cover Page… identifies Provider and Customer" | party names |
| Customer Policies | §1.1 "Provider will comply with Customer Policies, if any" | a policy text / where to find |
| DPA | §3.1 "If the parties have a DPA…" | a reference to a DPA |
| Security Policy | §3.2 "Provider will comply with the Security Policy, if any" | a policy / certifications |
| Effective Date | §5.1 start of Agreement; §13.5, §13.14 | a date |
| SOW Term | §5.1 "12 months… since the end of the latest SOW Term end date"; §6.4 prorated refund | a period WITH an end |
| Additional Warranties | §6.1(d) | free text per party |
| Increased Claims / Increased Cap Amount / General Cap Amount / Unlimited Claims | §8.1, §8.3 | claim lists + cap amounts |
| Provider/Customer Covered Claim(s) | §9.1, §9.2, §13.7 | claim text |
| Insurance Minimums | §10 "…Insurance Minimums required in the SOW, if any" | per-party policy list |
| Governing Law, Chosen Courts | §12.3 | state law + courts |
| Deliverables / Deliverable | §1.4, §2.1–2.4, §6.3, §12.12, §13.17–18 | a description |
| Rejection Period, Resubmission Period | §1.4, only "If according to the SOW Deliverables are subject to this section" | two durations + an opt-in |
| Customer Obligations | §1.6 "if any" | free text |
| Time of Assignment | §2.1 | one of two moments |
| Fees | §4, §5.3, §6.4, §12.11 | a fee description (USD unless SOW says otherwise) |
| Payment Period | §4.2, §4.4 ("within 15 days after the end of the Payment Period") | a period |

Load-bearing SOW rows that are **not** linked spans but the terms point to them:
- "Services" — §13.17 "Services means the services described in a SOW". Without it the
  Agreement has no scope. **Include (required).**
- "Third-Party Materials" — §2.4(a) "Provider may incorporate Third-Party Materials into
  Deliverables only if allowed in the SOW". **Include (optional).**
- "Invoice Period" — §4.1 "Provider will send invoices for Fees as described in the SOW".
  **Include.**
- "SOW Date" — the official SOW Term reads "begins on the SOW Date". **Include.**
- Currency — §4.1 "Unless the currency is specified in the SOW, all Fees are in U.S. Dollars".
  Covered by the Fees text (say it in the help).

### 1.3 Proposed Parley cover page — PSA

Title: "Professional Services Agreement". Label: "Cover page by Parley, not by Common Paper".
Two parts on one page, in the official order: **Statement of Work**, then **Key Terms**, then
one closing and one signature table (see judgment call J2).

Key to columns: **Opt** = optional (may stay empty in a complete document). Linked terms
listed in **Terms**. Option wording in quotes is Common Paper's exact text unless marked
*(Parley)*.

#### Parties (signature table, and the source of every "Provider"/"Customer")

| Key | Kind | Label | Help (≤15 words) | Terms | Opt |
|---|---|---|---|---|---|
| `provider` | party | Provider | The company doing the services. | Provider → `provider.company` | no |
| `customer` | party | Customer | The company buying the services. | Customer → `customer.company` | no |

Rule: the two companies must differ (same rule as the NDA). Possessive forms ("Customer's",
"Provider's", "Customer-procured") are the same term. Party `address`/`email` = the official
"Notice Address — Use email or postal address" (§12.8 "Notice Address").

#### Section: Statement of Work — hint "The business details of this engagement"

**Services** — hint "What Provider will do under this SOW"
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `services` | longText | Services | What Provider will do, with key people, timeline and milestones. | — | no |
Not a linked term (see 1.2). Wording from the official hint "Enter a description of the
Services to be performed under this SOW" + annotation "Include details such as key
individuals, overall project timeline, milestones, etc."

**Deliverables** — hint "What Provider hands over for Customer to own"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `deliverables` | longText | Deliverables | What Provider will hand over that Customer will own. Leave empty if none. | Deliverables, Deliverable | — | yes |
| `deliverableDrafts` | choice (one option = checkbox) | Include drafts | Also give Customer unfinished drafts and parts. | — | — | yes |

- Cover line for `deliverables`: "The **Deliverables** are: {value}" (official).
- `deliverableDrafts` option `included`: "In addition to completed projects, Deliverables include
  in-progress but not complete drafts or components of Deliverables and their associated
  intellectual property." (official). Not a linked term; include because it changes what
  "Deliverables" means. Rule: must be empty when `deliverables` is empty.
- Official checkbox "Deliverables will meet the attached specifications." — **leave out**:
  Parley has no attachments. The user can put specs in the Deliverables text.
- Annotation: "If there are no deliverables, delete this entire row, along with the rows for
  Time of Assignment and Third-Party Materials." → rule: when `deliverables` is empty,
  `acceptance`, `resubmissionPeriod`, `timeOfAssignment`, `thirdPartyMaterials` must be empty.

**Acceptance** — hint "How Customer reviews Deliverables (Section 1.4)"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `acceptance` | choice | Acceptance and Rejection Period | Can Customer reject a Deliverable, and for how long? | Rejection Period | — | yes |
| `resubmissionPeriod` | duration | Resubmission Period | Time Provider has to fix and resubmit a rejected Deliverable. | Resubmission Period | — | yes |

`acceptance` options:
- `applies`: "**Deliverables** are subject to the acceptance process in Section 1.4. Rejection
  Period: {value} from Deliverable submission" — nests `duration` (label "Rejection Period",
  help "Time Customer has to reject a Deliverable."). The first sentence and "from
  **Deliverable** submission" are official; joining them in one option is *(Parley)*.
- `notApplicable`: "Deliverables are not subject to the acceptance process in Section 1.4."
  *(Parley wording; the template's own default when the box is unchecked.)*

Why a choice and not a bare duration: §1.4 only applies "If according to the SOW Deliverables
are subject to this section", so the cover page must say it in words, not just show a number.
Rules: `resubmissionPeriod` required when `acceptance = applies`, empty otherwise. Resubmission
cover line: "{value} from notice of rejection" (official). Durations: official units are
"days, weeks, months"; Parley's `businessDays` is fine to allow. Default: none (Common Paper
gives no number). If the product wants a suggestion, 10 business days / 10 business days is a
common market choice — *Parley's guess, flag it*.

**Time of Assignment** — hint "When Customer becomes the owner of the Deliverables"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `timeOfAssignment` | choice | Time of Assignment | When Customer becomes the owner of the Deliverables. | Time of Assignment | none | yes (required if Deliverables set) |
Options (official, exact):
- `asCreated`: "**Customer** owns **Deliverables** as they are created."
- `uponPayment`: "**Customer** owns **Deliverables** upon payment of associated **Fees**."
Annotation: "as created" is customer-favorable, "upon payment" is provider-favorable. No
official default → no default; the AI should ask which side the user is on.

**Third-Party Materials** — hint "Whether others' materials may go into the Deliverables"
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `thirdPartyMaterials` | choice | Third-Party Materials | Can Deliverables include materials made by others, and who gets them? | `none` | yes |
Options (official sentences; the combined options are *(Parley)* joins of official sentences,
because the official has a radio plus two checkboxes):
- `none`: "No Third-Party Materials will be incorporated into the **Deliverables**."
- `providerProcures`: "Third-Party Materials will be incorporated into the **Deliverables**.
  **Provider** will procure Third-Party Materials."
- `customerProcures`: "Third-Party Materials will be incorporated into the **Deliverables**.
  **Customer** will procure Third-Party Materials."
- `bothProcure`: "Third-Party Materials will be incorporated into the **Deliverables**.
  **Provider** will procure Third-Party Materials. **Customer** will procure Third-Party
  Materials."
Not a linked term. Default `none` matches §2.4(a) when the SOW is silent.

**Fees** — hint "What Customer pays"
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `fees` | longText | Fees | What Customer pays: hourly, per project or per milestone. Name the currency if not USD. | Fees | no |
| `travelExpenses` | longText | Travel and expenses | How travel and expenses are paid, if at all. | — | yes |
- `fees` stays free text: the official hint is "Describe fees, whether hourly, by project, by
  milestone, etc. Also include any pass-through or fractional charges such as for tooling or
  third-party license fees." A single `money` field cannot hold that.
- `travelExpenses` cover line: "Travel and expenses: {value}" (official "[ ] Travel and
  expenses: [Describe or attach travel and expense policy.]"). Not linked.

**Payment Period** — hint "Time frame for Customer to pay invoices" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `paymentPeriod` | choice + Other | Payment Period | How long Customer has to pay each invoice. | Payment Period | `receipt` 30 days | no |
Options:
- `receipt`: "{value} from **Customer's** receipt of invoice" — nests duration. Official example
  "30 days from Customer's receipt of invoice"; Help Center default "30 days".
- `invoiceDate`: "{value} from the invoice date" — nests duration. Wording from the Software
  License order form ("[ Customer's receipt of invoice | the invoice date ]"), so still
  Common Paper wording.
- Other (free text ≤200): for milestone-based payment (Help Center: "If payment is based on
  custom parameters, such as completion of certain milestones…").

**Invoice Period** — hint "How frequently Provider sends invoices" (official)
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `invoicePeriod` | choice + Other | Invoice Period | How often Provider sends invoices. | `monthly` | no |
Options, from the official hint "e.g., month, quarter, upon acceptance, after each milestone"
and annotation "monthly, bi-monthly, weekly, upon acceptance, after each milestone":
`weekly` "Weekly", `monthly` "Monthly", `quarterly` "Quarterly", `uponAcceptance` "Upon
acceptance of each Deliverable" *(Parley expansion of "upon acceptance")*, `perMilestone`
"After each milestone". Other for anything else. Not a linked term (see 1.2).

**SOW Date** — hint "The date this SOW begins" (official)
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `sowDate` | choice | SOW Date | The date the work under this SOW starts. | `lastSignature` | no |
Options (official): `lastSignature` "Date of last signature on this Cover Page"; `custom`
"{value}" nests date. Not a linked term, but SOW Term starts from it.

**SOW Term** — hint "How long this SOW lasts" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `sowTerm` | choice + Other | SOW Term | How long the work under this SOW lasts. | SOW Term | `fixed` (see note) | no |
Cover lead-in (official): "The **SOW Term** begins on the **SOW Date** and ends:"
Options:
- `fixed`: "{value} after the **SOW Date**" — nests duration (official "[ # ][ days, weeks,
  months, year ] after the SOW Date", marked default `[ x ]`).
- `endDate`: "On {value}" — nests date *(official is "[ fill in custom end date ]"; "On" is
  Parley)*.
- `completion`: "When all **Deliverables** and **Fees** have been exchanged and any acceptance
  process is complete." *(Parley sentence built from the Help Center default "The engagement
  lasts until all Deliverables and Fees have been exchanged, and any acceptance processes are
  complete.")*
- Other: free text.
Default: official marks `fixed` with no number. Parley cannot store "fixed, no number yet" as a
default today (see 3.4). Suggest `fixed` + 3 months *(Parley guess, flag)* or `completion`
(the Help Center default). §5.1 needs an end date, so the SOW Term must end somehow.

**Customer Obligations** — hint "What Customer must do so Provider can work"
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `customerObligations` | longText | Customer Obligations | What Customer must do, like name a contact or give system access. | Customer Obligations | yes |
Official hint: "Fill in Customer's Obligations, e.g., identifying a single point of contact,
geographic limitations on use of Deliverables, etc."

(Official "Other Changes to Standard Terms — Changes that apply for this SOW only" is merged
into the one `otherChanges` field at the end; see J3.)

#### Section: Key Terms — hint "The legal details of this Agreement"

**Effective Date** — hint "The date the Agreement starts" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `effectiveDate` | choice | Effective Date | The date the Agreement starts. | Effective Date | `lastSignature` | no |
Options (official): `lastSignature` "Date of last signature on this Cover Page"; `custom`
"{value}" nests date. Note: the NDA definition uses a plain `date` with `defaultToday`. The PSA
official row is a choice, so mirror it (J6).

**Governing Law & Chosen Courts**
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `governingLaw` | jurisdiction | Governing law & courts | Which state's laws apply, and where disputes go to court. | Governing Law → `governingLaw.state`; Chosen Courts → `governingLaw.courtLocation` | no |
Cover lines, official wording: "Governing Law: The laws of {state}"; "Chosen Courts —
Jurisdiction or where disputes are filed: The courts (whether state, federal, or otherwise)
located in {courtLocation}". Official allows "state and/or country"; Parley is US-only (J7).

**Covered Claims** — hint "Claims covered by indemnity obligations" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `providerCoveredClaims` | choice | Provider Covered Claims | Third-party claims Provider must defend Customer against. | Provider Covered Claims, Provider Covered Claim | `standard` | yes |
| `customerCoveredClaims` | choice | Customer Covered Claims | Third-party claims Customer must defend Provider against. | Customer Covered Claims, Customer Covered Claim | `standard` | yes |

Each is a choice with two options (uses existing kinds):
- `standard`: the Committee text, exact:
  - Provider: "Any action, suit, proceeding, or claim that (a) the **Deliverables** (excluding
    any Customer Materials and Third-Party Materials procured by **Customer**), when used by
    **Customer** according to the terms of the SOW and the Agreement, violate, misappropriate,
    or otherwise infringe upon anyone else's intellectual property or other proprietary
    rights; (b) **Provider's** employees or Subcontractors are deemed to be **Customer's**
    employees because of Provider's actions or omissions; or (c) arises out of **Provider's**
    gross negligence, fraud, or willful misconduct."
  - Customer: "Any action, suit, proceeding, or claim that (a) Customer Materials or
    Third-Party Materials procured by **Customer**, when used by **Provider** according to the
    terms of the SOW and the Agreement, violate, misappropriate, or otherwise infringe upon
    anyone else's intellectual property or other proprietary rights; or (b) arises out of
    **Customer's** gross negligence, fraud, or willful misconduct."
    (The official page has a typo "claim tha [" — fix to "that"; flag.)
- `custom`: "{value}" nests longText (label "Custom covered claims"). Needed because the
  annotation says "You should modify it to address your particular situation. For example,
  subpart (a) will not be relevant if the services do not include creating deliverables." The
  200-char "Other" is too short, so use a nested longText instead of allowOther.
Default: both `standard` (official shows both `[ x ]`). Rule hint for the AI: when
`deliverables` is empty, suggest `custom` without subpart (a) of the Provider text.

**General Cap Amount** — hint "Limitation of liability amount for most claims" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `generalCapAmount` | choice (**needs new kinds**) | General Cap Amount | The most either party can owe for most claims. | General Cap Amount | `multiple` 1x | no (J4) |
Options (official, exact; PSA uses lowercase "fees"):
- `multiple`: "{multiple}x the fees paid or payable by **Customer** to **Provider** in the 12
  month period immediately before the claim." — needs a **multiplier number** (not in Parley).
- `fixed`: "${amount}" — nests money (currency may be non-USD; render with the currency).
- `greater`: "The greater of ${amount} or {multiple}x the fees paid or payable by **Customer**
  to **Provider** in the 12 month period immediately before the claim." — needs **money AND
  multiplier** in one option (Parley nests only one field).
Default: `multiple` with 1 (Help Center "Default: 1x…").
Annotations to show as help or AI guidance: "Deleting the General Cap Amount does not set it to
$0… either party could be responsible for an unlimited amount"; "In general, a $0 liability
cap would be unenforceable" → rule: money amount > 0, multiplier > 0.

**Increased Claims** — hint "Specific claims covered by the Increased Cap Amount" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `increasedClaims` | **multi-select** + Other | Increased Claims | Claims with a higher cap than the General Cap Amount. | Increased Claims | none | yes |
Options (official, exact, in order):
1. `privacySecurity`: "Breach of Section 3 (Privacy & Security)"
2. `confidentiality`: "Breach of Section 11 (Confidentiality) (however, excluding any breach of
   Section 3 (Privacy & Security))"
3. `indemnification`: "An Indemnifying Party's indemnification obligations for its Covered
   Claims"
4. `privacySecurityGross`: "Breach of Section 3 (Privacy & Security) resulting from gross
   negligence or willful misconduct"
5. `confidentialityGross`: "Breach of Section 11 (Confidentiality) resulting from gross
   negligence or willful misconduct (however, excluding any breach of Section 3 (Privacy &
   Security))"
6. `grossNegligence`: "Claims resulting from a party's gross negligence or willful misconduct"
7. Other: "Other: [ fill in ]"
Default: none (Help Center: "The default is to not include these").

**Increased Cap Amount** — hint "Higher limitation of liability amount for Increased Claims,
often called a supercap" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `increasedCapAmount` | choice (**needs new kinds**) | Increased Cap Amount | The higher cap for Increased Claims, often called a supercap. | Increased Cap Amount | `multiple` 5x | yes (required if Increased Claims set) |
Options: same three as General Cap Amount (official text identical, and the multiple is
"[ Fill in a number other than 1 ]"). Default 5x (Help Center). Rules: multiple ≠ 1; required
iff `increasedClaims` is set (annotation: "must be set if you are including Increased Claims.
If there are no Increased Claims, delete the entire row"). Soft warning if it is not higher
than the General Cap Amount when both use the same form.

**Unlimited Claims** — hint "Claims excluded from any liability cap" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `unlimitedClaims` | **multi-select** + Other | Unlimited Claims | Claims with no liability cap at all. | Unlimited Claims | none | yes |
Options (official, exact, official order):
1. "Breach of Section 3 (Privacy & Security) resulting from gross negligence or willful
   misconduct"
2. "Breach of Section 11 (Confidentiality) resulting from gross negligence or willful
   misconduct (however, excluding any breach of Section 3 (Privacy & Security))"
3. "An Indemnifying Party's indemnification obligations for its Covered Claims"
4. "Breach of Section 3 (Privacy & Security)"
5. "Breach of Section 11 (Confidentiality) (however, excluding any breach of Section 3 (Privacy
   & Security))"
6. "Claims resulting from a party's gross negligence or willful misconduct"
7. Other
Use the same option keys as Increased Claims. Rule: an option cannot be in both lists (Help
Center tip). Annotation to surface: the damages waiver in §8.2 still applies to Unlimited
Claims, except a confidentiality breach.

**Additional Warranties**
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `additionalWarrantiesProvider` | longText | Additional warranties by Provider | Extra promises Provider makes, beyond the standard terms. | Additional Warranties | yes |
| `additionalWarrantiesCustomer` | longText | Additional warranties by Customer | Extra promises Customer makes, beyond the standard terms. | Additional Warranties | yes |
`linkedTerms["Additional Warranties"] = ["additionalWarrantiesProvider",
"additionalWarrantiesCustomer"]` (arrays are already supported). Cover lines (official): "By
**Provider**: {value}", "By **Customer**: {value}".

**Insurance Minimums** — hint "Requirements for Provider's or Customer's policies" (official)
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `insuranceProvider` | longText | Insurance minimums for Provider | Insurance Provider must carry, with limits per occurrence and in total. | Insurance Minimums | yes |
| `insuranceCustomer` | longText | Insurance minimums for Customer | Insurance Customer must carry, with limits per occurrence and in total. | Insurance Minimums | yes |
Official structure (per party): checkboxes for Commercial general liability / Workers'
compensation "as required by Applicable Law" / Errors and omissions or professional liability
/ Cyber liability / Commercial automobile liability, each "with a minimum limit for each
occurrence of at least $[ ] and at least $[ ] in the aggregate", plus "The following of
**Provider's** policies will cover **Customer** as additional insured: Commercial general
liability / Errors and omissions / Cyber liability". Modeling this exactly needs a repeatable
group (multi-select × two money amounts each) — too much. **Proposal: longText per party**,
and give the AI the official sentence as a template, e.g. "Commercial general liability with a
minimum limit for each occurrence of at least $1,000,000 and at least $2,000,000 in the
aggregate". Flag (J8).

**Attachments and Supplements** — hint "Other documents that are part of this Agreement"
(official annotation: "All sections in the Attachments and Supplements section are optional.")
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `dpa` | text | DPA | Where to find the data processing agreement, if personal data is shared. | DPA | yes |
| `customerPolicies` | longText | Customer Policies | Customer rules Provider must follow, or where to find them. | Customer Policies | yes |
| `securityPolicy` | text | Security Policy | Where to find Provider's security policy. | Security Policy | yes |
| `securityCertifications` | **multi-select** + Other | Security certifications | Reports or certifications Provider keeps up to date each year. | Security Policy | yes |
- `dpa` official: "[ If required by law or appropriate for the Services, attach or describe
  where to find. ]" Parley cannot attach files → "describe where to find" only (a URL or
  "Common Paper DPA signed on …"). Parley also offers a DPA document; linking the two is a
  later feature (flag).
- `customerPolicies` official: "[ Attach or describe where to find. ]" Help Center examples:
  "Industry-specific compliance requirements", "Employee background checks or drug testing".
- `securityPolicy` cover line (official): "Security Policy available at {value}".
- `securityCertifications` cover line (official): "Provider will maintain annually updated
  reports or annual certifications of compliance with the following: {list}". Options
  (official, exact): "ISO 27001", "SOC 2 Type I", "SOC 2 Type II", "HITRUST", "Penetration
  testing", "PCI Level 1", "PCI Level 2", "FedRAMP Authorized", Other. Without multi-select,
  fall back to a longText.
- `linkedTerms["Security Policy"] = ["securityPolicy", "securityCertifications"]`.

**Changes to Standard Terms**
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `publicityRights` | choice | Publicity rights | May Provider name Customer as a customer? | none | yes |
| `otherChanges` | longText | Other changes to Standard Terms | Any changes to the Standard Terms, for the Agreement and this SOW. | — | yes |
- `publicityRights` (heading hint, official: "Modifying Section 12.7 of the Standard Terms").
  Not a linked term. Options (official, exact):
  - `public`: "**Provider** may identify **Customer** and use **Customer's** logo and trademarks
    on **Provider's** website and in marketing materials to identify **Customer** as a
    customer. **Customer** hereby grants **Provider** a non-exclusive, royalty-free license to
    do so in connection with any marketing, promotion, or advertising of **Provider** during
    the length of the Agreement."
  - `nonPublic`: "**Provider** may identify **Customer** as a customer in non-public settings,
    including with potential investors and advisors."
  Empty = the Standard Terms default (no publicity, §12.7). Official uses checkboxes, but
  `public` covers `nonPublic`, so single choice is fine.
- `otherChanges`: one field for both official rows ("Changes that apply for this SOW only" and
  "Changes that apply to the Agreement and all SOWs"), since Parley drafts one SOW with the
  Agreement (J3).

#### Closing and signatures

Closing (official, keep): "**Provider** and **Customer** have not changed the Standard Terms
except for the details on the Cover Page above. By signing this Cover Page, each party agrees
to enter into this Agreement as of the **Effective Date**." Suggested Parley addition for the
merged SOW: "…enter into this Agreement as of the **Effective Date** and into this SOW as of
the **SOW Date**." (official SOW closing: "By signing this Cover Page, each party agrees to
enter into this SOW as of the **SOW Date**."). Signatures: `provider`, `customer`.

Intro: see J1.

#### PSA `linkedTerms` map (all 26 terms)

```
Customer → customer.company            Provider → provider.company
Customer Policies → customerPolicies   DPA → dpa
Security Policy → [securityPolicy, securityCertifications]
Effective Date → effectiveDate         SOW Term → sowTerm
Additional Warranties → [additionalWarrantiesProvider, additionalWarrantiesCustomer]
Increased Claims → increasedClaims     Increased Cap Amount → increasedCapAmount
General Cap Amount → generalCapAmount  Unlimited Claims → unlimitedClaims
Provider Covered Claims / Provider Covered Claim → providerCoveredClaims
Customer Covered Claims / Customer Covered Claim → customerCoveredClaims
Insurance Minimums → [insuranceProvider, insuranceCustomer]
Governing Law → governingLaw.state     Chosen Courts → governingLaw.courtLocation
Deliverables / Deliverable → deliverables
Rejection Period → acceptance          Resubmission Period → resubmissionPeriod
Customer Obligations → customerObligations
Time of Assignment → timeOfAssignment
Fees → fees                            Payment Period → paymentPeriod
```
Fields on the cover page but not linked: `services`, `deliverableDrafts`,
`thirdPartyMaterials`, `travelExpenses`, `invoicePeriod`, `sowDate`, `publicityRights`,
`otherChanges`. They pass `coverage()` because they appear in cover sections.

---

## 2. Software License Agreement (`software-license-agreement`)

### 2.1 How the official cover page is built

Source: https://commonpaper.com/standards/software-license-agreement/ (Version 1.1; the
template's §11.30 also names "Common Paper Software License Standard Terms Version 1.1" at
https://commonpaper.com/standards/software-license-agreement/1.1 — versions match).

Official order:

**Order Form** ("The key business terms of this Agreement are as follows:")
1. Framework Terms ("This Order Form incorporates and is governed by the Framework Terms
   included below. If there is any inconsistency between this Order Form and the Framework
   Terms, this Order Form will control for this Agreement.")
2. Software ("The Software available under this Order Form is [ description of the software ].")
3. Order Date — "The earliest date Customer may install Software"
4. License details: Pilot (optional); Subscription Period; Fees (+ price increase / tax
   options); Payment Process; Auto-renewal (Non-Renewal Notice Date); Permitted Uses; License
   Limits; Warranty Period; Deletion Procedure
5. Additions, Supplements & Modifications: License Compliance Verification; Services; Other
   Changes to Standard Terms ("Changes that apply for this Order Form only")
6. Order Form signature block (the official page prints "COMPANY / PARTNER" here, which looks
   like a copy-paste slip from another standard; the Key Terms block uses PROVIDER / CUSTOMER)

**USING THE FRAMEWORK TERMS**, then **Key Terms**
1. Effective Date — "The date the Framework Terms start"
2. Governing Law ("The laws of [ fill in state, province, and/or country ]")
3. Chosen Courts — "Jurisdiction or where disputes are filed"
4. Covered Claims — "Claims covered by indemnity obligations"
5. General Cap Amount — "Limitation of liability amount for most claims"
6. Increased Claims — "Specific claims covered by the Increased Cap Amount"
7. Increased Cap Amount — "Higher limitation of liability amount for Increased Claims, often
   called a supercap"
8. Unlimited Claims — "Claims excluded from any limitation of liability"
9. Additional Warranties
10. Attachments, Supplements & Modifications: DPA; Other Changes to Standard Terms ("List
    specific changes to the Standard Terms")
11. Closing: "**Provider** and **Customer** have not changed the Standard Terms except for the
    details in the Key Terms above. By signing this Cover Page, each party agrees to enter into
    the Framework Terms."
12. Signature block PROVIDER / CUSTOMER.

Unlike the PSA, the template itself carries the "omitted = none" rule: §11.1 "Variables have
the meanings or descriptions given on a Cover Page. However, if the Order Form and the
governing Framework Terms omit or do not define a Variable, the default meaning will be
"none" or "not applicable"…". And §11.8: "A Cover Page may include an Order Form, Key Terms,
or both." → one Parley cover page with both parts is allowed by the terms themselves.

SLA-sw Help Center articles (collection above): 9807076 software, 9807088 order-date,
9807091 subscription-periods, 9807094 fees, 9807096 payment-process, 9807099 auto-renewal,
9807101 permitted-uses, 9807113 license-limits, 9807119 warranty-period, 9807127
deletion-procedure, 9807129 license-compliance-verification, 9807138 services, 9807169
effective-date, 9807175 governing-law-and-chosen-courts, 9807180 covered-claims, 9807182
general-cap-amount, 9807186 increased-and-unlimited-claims, 9807188 additional-warranties,
9807189 dpa. (URL form: https://help.commonpaper.com/en/articles/<id>-<slug>.)

Help Center "Default:" values for the Software License (these are the Common Paper app's
defaults; where they differ from the marks on the cover page, it is flagged below):
- Order Date: "The Effective Date of this agreement" (Effective Date default = last signature)
  — https://help.commonpaper.com/en/articles/9807088-order-date
- Subscription Period: "1 year" — https://help.commonpaper.com/en/articles/9807091-subscription-periods
- Payment Process: three options (Automatic Payment, Bill by Invoice, Custom Process).
  "Automatic Payment… This is the default selection, with monthly collection." Invoice
  defaults: "30 days from customer's receipt of invoice" —
  https://help.commonpaper.com/en/articles/9807096-payment-process
- Auto-renewal: "Default: Yes"; Non-Renewal Notice Date "Default: 30 days" —
  https://help.commonpaper.com/en/articles/9807099-auto-renewal
- Permitted Uses: "Default: Customer's internal business purposes"; "Custom" option for other
  uses — https://help.commonpaper.com/en/articles/9807101-permitted-uses
- License Limits examples: country or region, maximum number of users, transfer limitations —
  https://help.commonpaper.com/en/articles/9807113-license-limits
- Warranty Period: "Default: 30 days from initial delivery of Software"; "if you do not want
  to provide a limited warranty, you can choose None." —
  https://help.commonpaper.com/en/articles/9807119-warranty-period
- Deletion Procedure: "Default: Customer will uninstall, delete, and/or discontinue use of the
  Software. Customer will certify to Provider that the Software was uninstalled or deleted
  according to the terms of this Agreement." —
  https://help.commonpaper.com/en/articles/9807127-deletion-procedure
- Covered Claims: default covers BOTH the Provider IP claim AND "A lawsuit related to your
  customer violating the restrictions in the Agreement" —
  https://help.commonpaper.com/en/articles/9807180-covered-claims (the cover page leaves the
  Customer box unchecked: conflict, see J13)
- General Cap Amount: "Default: 1x the fees paid or payable…" —
  https://help.commonpaper.com/en/articles/9807182-general-cap-amount
- Increased/Unlimited Claims: "The default is to not include these"; Increased Cap Amount
  "Default: 5x the fees paid or payable…"; "not both" tip —
  https://help.commonpaper.com/en/articles/9807186-increased-and-unlimited-claims (the cover
  page pre-marks one Increased and one Unlimited option: conflict, see J13)


### 2.2 How the template uses each linked term

| Term | Where | What it needs |
|---|---|---|
| Provider, Customer (coverpage_link) | everywhere; §11.8 | party names |
| Subscription Period(s) | §1.1 license, §1.6 updates, §4.1 renewal, §4.4 & §8.4 refunds, §11.23 | a length |
| Permitted Uses | §1.1 | a use scope |
| License Limits | §2.1(b) | limits text |
| Payment Process | §3.2, §3.3 ("with invoicing" / "with automatic payment"), §3.5 | method + cadence + due time |
| Order Date | §4.1 start of each Order Form | a date |
| Non-Renewal Notice Date | §4.1 | a notice period (or no auto-renew) |
| Deletion Procedure | §4.5(a) | a list of steps |
| Warranty Period | §5.2 | a period from a start event |
| Effective Date | §1.7, §4.2, §11.7 | a date |
| Additional Warranties, caps, claims, Covered Claims, Governing Law, Chosen Courts | §5.1, §7, §8, §10.3 | as PSA |

Load-bearing rows that are **not** linked spans:
- "Software" — §11.29 "Software means the product described in the Order Form". Without it
  the license has no object. **Include (required).**
- "Fees" — §11.14 "Fees means the applicable amounts described in an Order Form" (Fees is
  plain text, not a linked span, in this template). **Include (required).**
- "Services" — §11.28 "the support and maintenance services described in the Order Form".
  **Include (optional).**
- DPA — on the official Key Terms, but the template never names "DPA". Optional; include for
  parity with Common Paper, or drop (it has no effect in the terms). Recommend include as an
  optional attachment reference.

### 2.3 Proposed Parley cover page — Software License Agreement

Title: "Software License Agreement". Label: "Cover page by Parley, not by Common Paper".
Parts in official order: **Order Form**, then **Key Terms**, then one closing and one
signature table.

#### Parties
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `provider` | party | Provider | The company licensing the software. | Provider → `provider.company` | no |
| `customer` | party | Customer | The company installing and using the software. | Customer → `customer.company` | no |
Rule: different companies. Possessives ("Customer's", "Provider's") are the same term.

#### Section: Order Form — hint "The business details of this license"

**Software**
| Key | Kind | Label | Help | Opt |
|---|---|---|---|---|
| `software` | longText | Software | The software product Customer may install and use. | no |
Cover line (official): "The Software available under this Order Form is {value}." Not linked
(see 2.2).

**Order Date** — hint "The earliest date Customer may install Software" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `orderDate` | choice | Order Date | The earliest date Customer may install the Software. | Order Date | `lastSignature` | no |
Options (official): `lastSignature` "Date of last signature on this Order Form"; `custom`
"{value}" nests date. Official default `( x )` = last signature (Help Center says "The
Effective Date of this agreement", which is the same day when both default to last
signature). With one Parley cover page,
"this Order Form" is signed by the same signatures; keep the official words (J2).

**Subscription Period**
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `subscriptionPeriod` | duration | Subscription Period | How long the license lasts before it renews. | Subscription Period, Subscription Periods | 1 year | no |
Official: "[ Fill in length of license, e.g. 12 months ]"; Help Center "Default: 1 year". Required: §1.1 grants the license only "During the Subscription Period".
(Perpetual licenses are out of scope: annotation says the standard "supports the
subscription-based licensing model".)

**Fees**
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `fees` | longText | Fees | What Customer pays for the license and services. Name the currency if not USD. | — | no |
| `feeIncrease` | choice | Fee increase at renewal | Can Fees go up when the subscription renews? | none | yes |
| `feesIncludeTax` | choice (one option = checkbox) | Fees include taxes | Are the listed Fees inclusive of taxes? | none | yes |
- `fees`: official "[ describe fees ]". §3.1: USD unless the Order Form says otherwise.
- `feeIncrease` options (official, exact; percent nested):
  - `upTo`: "Fees may increase up to {value} per renewal if **Provider** has given notice of the
    increase prior to the **Non-Renewal Notice Date**." (nests percent)
  - `fixed`: "Fees will increase {value} per renewal." (nests percent)
  Rule: `upTo` needs `autoRenewal = notice` (it points to the Non-Renewal Notice Date).
- `feesIncludeTax` option `included`: "Modifying Section 3.1 of the Standard Terms, Fees are
  inclusive of taxes." (official). Annotation: for "regions that use a VAT-inclusive model".
- None of these three are linked terms; `fees` is load-bearing, the other two are optional
  extras (could be cut for v1 without harm).

**Payment Process** — hint "How billing and payment work" (annotation: "Use Payment Process to
clarify how billing and payments will work for your customer.")
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `paymentMethod` | choice + Other | Payment method | Pay by invoice, or automatic charge to a card on file? | Payment Process | `automatic` (Help Center) | no |
| `billingFrequency` | choice | Billing frequency | How often Provider invoices or charges Customer. | Payment Process | `monthly` (Help Center) | no |
| `paymentDue` | choice | Invoice due | How long Customer has to pay each invoice. | Payment Process | `receipt` 30 days | yes (required iff invoice) |
- `paymentMethod` options (official):
  - `invoice`: "Pay by invoice"
  - `automatic`: "Automatic payment" — with the official sentence on the cover page:
    "**Customer** authorizes **Provider** to bill and charge Customer's payment method on file
    {billingFrequency} for immediate payment or deduction without further approval."
- `billingFrequency` options (official list "[ monthly | quarterly | annually | once per
  Subscription Period ]"): `monthly` "monthly", `quarterly` "quarterly", `annually`
  "annually", `oncePerPeriod` "once per **Subscription Period**".
- `paymentDue` options (official "Customer will pay each invoice within [ # ] days from [
  Customer's receipt of invoice | the invoice date ]"):
  - `receipt`: "within {value} from **Customer's** receipt of invoice" (nests duration)
  - `invoiceDate`: "within {value} from the invoice date" (nests duration)
  Rule: required when `paymentMethod = invoice`, empty when `automatic`.
- `linkedTerms["Payment Process"] = ["paymentMethod", "billingFrequency", "paymentDue"]`.
- Official cover page has no default radio. Help Center default: Automatic Payment, monthly;
  invoice path defaults to 30 days from receipt (NET-30). Other = the Help Center's "Custom
  Process" ("describe your payment process in your own words"). See J14.
- The ideal render is the official full sentences ("**Provider** will invoice **Customer**
  annually. **Customer** will pay each invoice within 30 days from **Customer's** receipt of
  invoice."). That needs the multi-placeholder option from 3.3; with today's kinds it renders
  as three labelled lines.

**Auto-renewal**
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `autoRenewal` | choice | Auto-renewal and Non-Renewal Notice Date | Does the license renew, and how early must a party say no? | Non-Renewal Notice Date | `notice` 30 days | no |
Options (official, exact):
- `notice`: "**Non-Renewal Notice Date**: At least {value} before the end of the current
  **Subscription Period**" (nests duration; official "[ # ] days"). Official default `( x )`.
  30 days = the annotation's example ("e.g., 30 days before the end of the Subscription
  Period").
- `noRenewal`: "Modifying Section 4.1 of the Standard Terms, this Order Form does not
  automatically renew and will expire at the end of the **Subscription Period**."

**Permitted Uses**
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `permittedUses` | choice | Permitted Uses | What Customer may use the Software for. | Permitted Uses | `internal` | no |
| `permittedUsesExtra` | longText | Additional permitted uses | Other allowed uses, like shipping the Software inside hardware. | Permitted Uses | — | yes |
- `permittedUses` options (official, exact): `internal` "**Customer's** internal business
  purposes" (official default `( x )`); `internalWithAffiliates` "**Customer's** and its
  Affiliates' internal business purposes."
- `permittedUsesExtra`: official "[ ] [ fill in details about additional permitted uses ]";
  annotation example: "software is included as firmware in a piece of hardware".
- `linkedTerms["Permitted Uses"] = ["permittedUses", "permittedUsesExtra"]`.

**License Limits**
| Key | Kind | Label | Help | Terms | Opt |
|---|---|---|---|---|---|
| `licenseLimits` | longText | License Limits | Limits on use, like seats, devices, locations or regions. | License Limits | yes |
Official: "[ Insert any limitations on the license grant, such as restriction to certain
locations, count or user limits, geographic limits, transfer limitations, etc. ]"; annotation:
"Including license limits is optional."

**Warranty Period**
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `warrantyPeriod` | choice | Warranty Period | How long Provider promises the Software works as documented. | Warranty Period | `fromDelivery` 30 days (Help Center) | no |
Options:
- `fromDelivery`: "{value} from delivery of the Software" (nests duration)
- `fromDeliveryAndUpdates`: "{value} from delivery of the Software and each subsequent Update"
- `fromOrderDate`: "{value} from the **Order Date**"
- `none`: "None. Sections 5.2–5.4 do not apply." (official annotation: "if you do not want to
  provide a limited warranty, you can replace the text in this section with: 'None. Sections
  5.2–5.4 do not apply.'")
All wording official ("[ # days ] from [ delivery of the Software | delivery of the Software
and each subsequent Update | the Order Date ]"). Required with an explicit "None" option so
the choice is always visible. Default 30 days from delivery: Help Center "Default: 30 days
from initial delivery of Software".

**Deletion Procedure**
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `deletionProcedure` | **multi-select** + Other | Deletion Procedure | What happens to the Software when the license ends. | Deletion Procedure | `[uninstall, certify]` (Help Center) | yes |
Options (official, exact):
- `disableKeys`: "**Provider** will disable license keys"
- `uninstall`: "**Customer** will uninstall, delete, and/or discontinue use of the Software"
- `certify`: "**Customer** will certify to Provider that the Software was uninstalled or deleted
  according to the terms of this Agreement"
- Other: "[ fill in details about deletion procedure ]"
Annotation: "Choose one or more of the suggested protocols, and/or detail other customer
deletion requirements." Help Center default: `uninstall` + `certify`. Without multi-select:
longText fallback, or a single choice with the useful combinations (weak).

**Additions, Supplements & Modifications** — hint "Optional extras for this Order Form"
| Key | Kind | Label | Help | Default | Opt |
|---|---|---|---|---|---|
| `complianceVerification` | choice | License compliance verification | Can Provider audit how Customer uses the Software? | none | yes |
| `services` | longText | Services | Support or maintenance Provider gives with the Software. | — | yes |
- `complianceVerification`: not linked. Options: `standard` = official Committee text:
  "**Provider** may inspect and audit **Customer's** use of the Software under this Agreement
  during the **Subscription Period**, and **Customer** agrees to cooperate or otherwise make
  available the information that may be reasonably requested by **Provider** in order to
  ensure compliance with this Agreement and any usage restrictions. **Provider** must give at
  least 7 days advance notice of an audit. If the audit determines that **Licensee's** use of
  the Software exceeded the usage permitted by the Agreement, **Customer** will pay to
  **Provider** all amounts due for such excess use of the Software according to the **Payment
  Process**." — note the official slip "Licensee's"; Parley should print "Customer's" and say
  so (flag). `custom` = "{value}" nests longText.
- `services`: official "[ Insert description of any included service(s), such as support or
  maintenance services. ]" Not linked, but §11.28 depends on it.
- Pilot: **leave out for v1**. Not linked, and it defines its own "Pilot Period" with four
  sub-changes; a user who needs it can use `otherChanges`. Flag.

#### Section: Key Terms — hint "The legal details of the Framework Terms"

**Effective Date** — hint "The date the Framework Terms start" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `effectiveDate` | choice | Effective Date | The date the Framework Terms start. | Effective Date | `lastSignature` | no |
Options (official, note the different words from the PSA): `lastSignature` "Date of last Cover
Page signature"; `custom` "{value}" nests date.

**Governing Law & Chosen Courts** — same as PSA: `governingLaw` jurisdiction, Governing Law →
`.state`, Chosen Courts → `.courtLocation`. Official: "The laws of [ fill in state, province,
and/or country ]"; "The courts (whether state, federal, or otherwise) located in [ fill in
state, province, and/or county ]". US-only in Parley (J7).

**Covered Claims** — hint "Claims covered by indemnity obligations"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `providerCoveredClaims` | choice | Provider Covered Claims | Third-party claims Provider must defend Customer against. | Provider Covered Claims, Provider Covered Claim | `standard` | yes |
| `customerCoveredClaims` | choice | Customer Covered Claims | Third-party claims Customer must defend Provider against. | Customer Covered Claims, Customer Covered Claim | `standard` (Help Center; J13) | yes |
Options `standard` (official Committee text) and `custom` "{value}" (nested longText):
- Provider standard: "Any action, proceeding, or claim that the Software, when used by
  **Customer** according to the terms of the Agreement, violates, misappropriates, or
  otherwise infringes upon anyone else's intellectual property or other proprietary rights."
  Official default `[ x ]`.
- Customer standard: "Any action, proceeding, or claim arising from or related to
  **Customer's** or Users' breach or violation of Section 1.1 (License) or Section 2.1
  (Restrictions on Customer)." Cover page shows it unchecked `[ ]`; Help Center default
  includes it. Recommend default `standard` (J13).

**General Cap Amount** — hint "Limitation of liability amount for most claims"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `generalCapAmount` | choice (**needs new kinds**) | General Cap Amount | The most either party can owe for most claims. | General Cap Amount | `multiple` 1x | no (J4) |
Options (official, exact; this doc capitalizes "**Fees**" and has no final period on the first
and third):
- `multiple`: "{multiple}x the Fees paid or payable by **Customer** to **Provider** in the 12
  month period immediately before the claim" — official default `( x )`
- `fixed`: "${amount}"
- `greater`: "The greater of ${amount} or {multiple}x the Fees paid or payable by **Customer**
  to **Provider** in the 12 month period immediately before the claim"
(The official hybrid says "[ fill in a number 1 ]" — a typo; treat as "a number".)

**Increased Claims** — hint "Specific claims covered by the Increased Cap Amount"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `increasedClaims` | **multi-select** + Other | Increased Claims | Claims with a higher cap than the General Cap Amount. | Increased Claims | `[confidentiality]` | yes |
Options (official, exact, order):
1. `confidentiality`: "Breach of Section 9 (Confidentiality) (however, excluding any data or
   security breaches)" — official default `[ x ]`
2. `indemnification`: "An Indemnifying Party's indemnification obligation"
3. `licenseBreach`: "**Customer's** breach of Section 1.1 (License) or Section 2.1
   (Restrictions on Customer)"
4. `grossNegligence`: "A party's gross negligence or willful misconduct"
5. `confidentialityGross`: "Breach of Section 9 (Confidentiality) resulting from gross
   negligence or willful misconduct (however, excluding any data or security breaches)"
6. Other: "Other: [ fill in ]"

**Increased Cap Amount** — hint "Higher limitation of liability amount for Increased Claims,
often called a supercap"
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `increasedCapAmount` | choice (**needs new kinds**) | Increased Cap Amount | The higher cap for Increased Claims, often called a supercap. | Increased Cap Amount | `multiple` (number: see note) | yes (required iff Increased Claims) |
Options (official): `multiple` "{multiple}x the Fees paid or payable by **Customer** to
**Provider** in the 12 month period immediately before the claim." (official default `[ x ]`,
"a number other than 1"); `fixed` "${amount}"; `greater` "The greater of ${amount} or
{multiple}x the Fees paid or payable by **Customer** to **Provider** in the 12 month period
immediately before the claim." Number default 5x (Help Center "Default: 5x…"). Rule: multiple
≠ 1.

**Unlimited Claims** — hint "Claims excluded from any limitation of liability" (official)
| Key | Kind | Label | Help | Terms | Default | Opt |
|---|---|---|---|---|---|---|
| `unlimitedClaims` | **multi-select** + Other | Unlimited Claims | Claims with no liability cap at all. | Unlimited Claims | `[indemnification]` | yes |
Options (official, exact, order):
1. `indemnification`: "An Indemnifying Party's indemnification obligation" — official default
   `[ x ]`
2. `confidentialityGross`: "Breach of Section 9 (Confidentiality) resulting from gross
   negligence or willful misconduct (however, excluding any data or security breaches)"
3. `grossNegligence`: "A party's gross negligence or willful misconduct"
4. `confidentiality`: "Breach of Section 9 (Confidentiality) (however, excluding any data or
   security breaches)"
5. `licenseBreach`: "**Customer's** breach of Section 1.1 (License) or Section 2.1
   (Restrictions on Customer)"
6. Other
Rule: no option in both Increased and Unlimited. Annotation to surface: picking options 2, 4
or 5 as Unlimited removes both the cap and the damages waiver for them.

**Additional Warranties** — as PSA: `additionalWarrantiesProvider`,
`additionalWarrantiesCustomer` (longText, optional), `linkedTerms["Additional Warranties"]`
= both. Official "[ ] By **Provider** [ fill in ]" / "[ ] By **Customer** [ fill in ]".
Annotation suggestion the AI can offer for Provider: "the Software, when used as authorized by
the Agreement, does not and will not infringe or misappropriate anyone else's copyright,
trademark, trade secret, [[U.S.] patent], or right of publicity" (brackets = judgment; the
patent part is risky for providers).

**Attachments, Supplements & Modifications**
| Key | Kind | Label | Help | Opt |
|---|---|---|---|---|
| `dpa` | text | DPA | Where to find the data processing agreement, if any. | yes |
| `otherChanges` | longText | Other changes to Standard Terms | Any changes to the Standard Terms for this Agreement. | yes |
`dpa` is not a linked term in this template (keep or drop, see 2.2). One `otherChanges` field
replaces the two official rows (Order Form only / Key Terms) (J3).

#### Closing and signatures
Official Key Terms closing: "**Provider** and **Customer** have not changed the Standard Terms
except for the details in the Key Terms above. By signing this Cover Page, each party agrees
to enter into the Framework Terms." Official Order Form closing: "By signing this Order Form,
each party agrees to enter into this Order Form." Suggested merged closing *(Parley)*:
"**Provider** and **Customer** have not changed the Standard Terms except for the details on
this Cover Page. By signing this Cover Page, each party agrees to enter into the Framework
Terms and this Order Form." Signatures: `provider`, `customer`.

#### Software License `linkedTerms` map (all 22 terms)
```
Provider → provider.company              Customer → customer.company
Subscription Period / Subscription Periods → subscriptionPeriod
Permitted Uses → [permittedUses, permittedUsesExtra]
License Limits → licenseLimits
Payment Process → [paymentMethod, billingFrequency, paymentDue]
Order Date → orderDate                   Non-Renewal Notice Date → autoRenewal
Deletion Procedure → deletionProcedure   Warranty Period → warrantyPeriod
Effective Date → effectiveDate
Additional Warranties → [additionalWarrantiesProvider, additionalWarrantiesCustomer]
General Cap Amount → generalCapAmount    Increased Claims → increasedClaims
Increased Cap Amount → increasedCapAmount  Unlimited Claims → unlimitedClaims
Provider Covered Claims / Provider Covered Claim → providerCoveredClaims
Customer Covered Claims / Customer Covered Claim → customerCoveredClaims
Governing Law → governingLaw.state       Chosen Courts → governingLaw.courtLocation
```
Cover-only fields: `software`, `fees`, `feeIncrease`, `feesIncludeTax`,
`complianceVerification`, `services`, `dpa`, `otherChanges`.

---

## 3. Field kinds Parley lacks (both documents)

### 3.1 Multi-select choice (needed)
Used by: Increased Claims, Unlimited Claims (both docs), Deletion Procedure, Security Policy
certifications. Common Paper uses `[ ]` = "pick none, one, or more than one" for all of them.
Needs: option keys with exact labels, optional "Other" text, render as a list (one per line,
or "a; b; and c" inline). The spec already lists "choice (single or multiple)" (spec.md §2
item 4) and the questionnaire has `multiple` (spec.md, `askQuestions`), so this is filling a
promised gap, not a new idea.
Fallback without it: longText with the official options given to the AI as suggestions. This
loses exact wording checks and the "not in both lists" rule. Not recommended for the caps.

### 3.2 Number / multiplier (needed)
"[ Fill in a number ]x the fees…" — a positive number, decimals allowed (1.5x is common),
rendered as "2x". `percent` (0–100) is the wrong meaning; `duration`/`money` do not fit.
Suggest a small `number` kind with `min`, `max`, `step`, and a `suffix` ("x"), or a dedicated
`multiplier` kind.

### 3.3 More than one placeholder in a choice option (needed)
"The greater of ${amount} or {multiple}x the fees…" needs money + number in one option. Same
shape would also make the Payment Process sentence render like the official one. Suggest
`with` accepting a record of named fields: `label: "The greater of {amount} or {multiple}x
…", with: { amount: field.money(…), multiple: field.number(…) }`. Keeps "one choice = one
term" and keeps linked-term mapping simple.
Fallback with today's kinds: drop the `greater` option (loses an official option; bad), or
split into `generalCapForm` choice + `generalCapMultiple` + `generalCapMoney` fields with
rules (works, but three fields for one term and a clumsy UI).

### 3.4 Small gaps (nice to have)
- **Checkbox**: `deliverableDrafts`, `feesIncludeTax` are one-option optional choices. Works
  today; a `boolean`/checkbox kind would read better in the form.
- **Suffix on a cover line**: "{duration} from notice of rejection". Today a line is `label:
  value`. A `template` on a cover line ("{value} from notice of rejection") would print the
  official words without inventing a choice.
- **Draft default for a choice**: Common Paper often pre-marks an option but leaves the number
  blank (SOW Term `[ x ] [ # ] …`, Warranty Period). `default` is typed as a complete value, so
  Parley must invent a number or pick no default. Allowing a draft-shaped default (`{ option:
  "fixed" }`) would mirror the official page exactly.
- **Structured insurance**: a repeatable "policy type + per-occurrence $ + aggregate $" group
  would model Insurance Minimums exactly. Not worth it now; longText is fine (J8).

---

## 4. Legal judgment calls to flag

- **J1. The intro ("Using this agreement") is what makes the cover page work.** The PSA
  standard terms have no "omitted = none" rule; that rule lives only on Common Paper's cover
  page ("if the Cover Page omits or does not define a highlighted word, the default meaning
  will be 'none' or 'not applicable'…"). Parley's cover page must carry an equivalent intro:
  incorporate the Standard Terms by reference (name + version + URL), say the Cover Page wins
  over the Standard Terms, and state the omitted-variable rule. The safest path is to reuse
  Common Paper's paragraph verbatim with CC BY 4.0 attribution (allowed; the NDA definition
  already reuses official paragraphs). The Software License terms carry the rule in §11.1, but
  still need the incorporation sentence ("USING THE FRAMEWORK TERMS" paragraph).
- **J2. One signature for two parts.** Common Paper signs the SOW/Order Form and the Key Terms
  separately. Parley has one `signatures` list. One signature table with a merged closing
  sentence (drafts above) is fine for a first SOW/Order Form signed with the Agreement; the
  official FAQ says "In most cases, people will create a Professional Services Agreement and
  the first SOW at the same time" (https://commonpaper.com/documents/statement-of-work/). The
  "Date of last signature on this Order Form / Cover Page" options stay true.
- **J3. One "Other changes" field** instead of two (SOW-only vs Agreement-wide; Order-Form-only
  vs Framework). With one SOW/Order Form drafted together, the difference only matters for
  later SOWs. Say in the help that changes apply to the Agreement and this SOW.
- **J4. General Cap Amount required?** Common Paper lets you delete it, but the annotation
  warns that means unlimited liability for both sides. Recommend required in Parley (or
  optional with a strong warning). Same for choosing a $0 amount ("would be unenforceable").
- **J5. Defaults Common Paper does not give.** Only the PSA Rejection/Resubmission Periods,
  the SOW Term length, and the PSA Invoice Period. Either leave empty (the AI asks) or use
  market-typical guesses (10 business days each; 3 months or "until complete"; monthly). Mark
  any guess as Parley's. All other defaults above come from Common Paper (cover page `x`
  marks or Help Center "Default:").
- **J6. Effective Date as choice vs date.** Official rows are "Date of last signature" or a
  custom date. The NDA definition uses a `date` with `defaultToday`. For these two documents,
  mirror the official choice: "today" is not the same as "last signature".
- **J7. Jurisdiction is US-only.** Common Paper allows "state and/or country" (PSA) and
  "state, province, and/or country" (Software License); its annotation says the standards
  "were created with the laws of the United States in mind". Keep US-only for launch; note it.
- **J8. Insurance Minimums as free text.** Loses the checklist structure but keeps every
  option expressible. The AI should be told the official sentence pattern.
- **J9. Non-linked rows we add.** Services (PSA), Software and Fees (Software License) are not
  linked spans but the definitions say they live on the SOW / Order Form; without them the
  contract has no scope or price. The spec (§"The 12 documents") says Parley's cover page
  "lists the variables its template refers to" — these rows go slightly beyond that. Recommend
  including them; the definitions (§13.17, §11.29, §11.14) make them part of the variable set
  in substance.
- **J10. Deliverable-dependent rows.** When a PSA has no Deliverables, Time of Assignment,
  acceptance and Third-Party Materials should be empty, and the Provider Covered Claims
  subpart (a) should be dropped. Encode as rules + AI guidance.
- **J11. Fixing official typos.** "claim tha" (PSA Customer Covered Claims), "Licensee's"
  (Software License audit text), "a number 1" (Software License hybrid cap), "COMPANY /
  PARTNER" (Software License Order Form signature labels). Parley's own cover page should
  print the corrected words.
- **J12. PSA version.** The web page says the current PSA is 1.1
  (https://commonpaper.com/standards/professional-services-agreement/). The repo's `psa.md` has
  no version line, and CommonPaper/PSA on GitHub was last changed Dec 2023 with a README that
  links 1.0. The repo text matches the 1.1 text in every spot checked (Security Policy,
  Customer Policies, insurance "date of occurrence form", 45-day warranty notice), but the
  intro must name one version. Confirm before writing the intro.
  **Resolved:** the versions page
  (https://commonpaper.com/standards/professional-services-agreement/versions) says 1.1
  (Dec 12, 2023) changed only "Section 11.3: change 'Disclosing Party' to 'Discloser'". The
  repo's §11.3 says "Discloser", so `templates/psa.md` is **Version 1.1**. The intro should
  cite "Common Paper Professional Services Standard Terms Version 1.1" at
  commonpaper.com/standards/professional-services-agreement/1.1.
- **J13. Common Paper's two sources disagree on some Software License defaults.** The cover
  page pre-marks Increased Claims = Confidentiality and Unlimited Claims = indemnification,
  and leaves Customer Covered Claims unchecked; the Help Center says Increased/Unlimited
  default to none and Customer Covered Claims are on. Recommendation: follow the cover page for
  Increased/Unlimited (doc-specific marks; the Help Center article reads like a copy of the PSA
  one, it talks about "privacy, security"), and follow the Help Center for Customer Covered
  Claims (explicit "Default:"). Either way, the AI should ask; these are negotiated terms.
- **J14. Payment Process default.** The cover page pre-marks nothing; the Help Center default
  is Automatic Payment, monthly. Automatic payment by card suits self-serve deals; B2B software
  licenses usually invoice. Recommend Help Center default, AI confirms.
