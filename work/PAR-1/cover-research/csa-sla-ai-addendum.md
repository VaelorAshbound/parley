# Cover page research, group A: CSA, SLA, AI Addendum

Researched 2026-09-24. Read-only; no project files changed.
Web pages fetched with the firecrawl CLI; GitHub repos read with `gh api`.

## Sources

| # | What | URL |
|---|---|---|
| S1 | CSA landing page. Has the **full official CSA v2.1 cover page** (Order Form + Key Terms) and its annotations | https://commonpaper.com/standards/cloud-service-agreement/ |
| S2 | CSA version history (latest published = 2.1, Nov 4 2024) | https://commonpaper.com/standards/cloud-service-agreement/versions/ |
| S3 | CSA 3.0 hosted terms: **404 "This page doesn't exist"** (checked 2026-09-24) | https://commonpaper.com/standards/cloud-service-agreement/3.0/ |
| S4 | CommonPaper/CSA GitHub, `main` = v3 (PR #12 "update terms for CSA v3", 2026-09-16; #13, #14 up to 2026-09-21). Our `templates/CSA.md` is byte-identical to `main` | https://github.com/CommonPaper/CSA |
| S5 | Diff CSA 2.1 → main (v3) | https://github.com/CommonPaper/CSA/compare/2.1...main |
| S6 | Order Form page + Google Doc "Order Form with Common Paper SLA" (CSA v2.1) | https://commonpaper.com/documents/order-form/ , https://docs.google.com/document/d/11Q6rn36MuJkHnoSMirV4naQu0x_QcG1qGKX6blJs_FY |
| S7 | SLA landing page. Has the **full official SLA cover page** and annotations | https://commonpaper.com/standards/service-level-agreement/ |
| S8 | SLA 2.0 standard terms (matches `templates/sla.md`, same as CommonPaper/SLA `sla.md`) | https://commonpaper.com/standards/service-level-agreement/2.0/ |
| S9 | Help Center "SLA (optional)" | https://help.commonpaper.com/en/articles/6535103-sla-optional |
| S10 | AI Addendum landing page | https://commonpaper.com/standards/ai-addendum/ |
| S11 | **Official AI Addendum standalone cover page** (DOCX) | https://commonpaper.com/standards/ai-addendum/1.0/cover-page-and-standard-terms-docx |
| S12 | AI Addendum 1.0 standard terms (matches `templates/AI-Addendum.md` and CommonPaper/AI-Addendum) | https://commonpaper.com/standards/ai-addendum/1.0/ |
| S13 | CSA benchmark numbers quoted in S1 annotations | https://commonpaper.com/resources/contract-benchmark-2024-Q1 |

Raw scrapes are in `scratchpad/fc/` (`csa-landing.md`, `sla-landing.md`, `A-ai-docx.md`, `of-sla-gdoc.md`, …) and `scratchpad/A-csa-v21-v3.patch`.

## Ground rules I used (apply to all three)

1. **"None" is a real answer.** When leaving a term out has a legal meaning (Common Paper: "If you omit a definition from the Cover Page, the meaning will default to 'none' or 'not applicable'", S1), use a `choice` with an explicit `none` option. The printed page then says "None" instead of a blank. Plain free text (like "Other changes") uses `optional: true`.
2. **Option wording is Common Paper's, word for word**, where it exists. Parley-written text is marked *(Parley)*.
3. **Parties:** `Provider` → `provider.company`, `Customer` → `customer.company`. Possessives ("Provider's") and plurals map to the same path.
4. `Other` answers are capped at 200 chars in `fields.ts`. Where a custom answer can be long (covered claims), use a `{value}` option with a nested `longText` instead of `allowOther`.

---

## 1. Cloud Service Agreement (`templates/CSA.md`)

### Big finding: our template is CSA **v3**, which Common Paper has not published yet

- `templates/CSA.md` = CommonPaper/CSA `main` (S4). Its 13.30 says "Version 3.0 … posted at https://commonpaper.com/standards/cloud-service-agreement/3.0/". That URL is **404** today (S3). The site says 2.1 is the latest (S1, S2).
- The only official cover page is **v2.1** (S1). v3 changed what the cover page must hold (S5):
  - **Gone from the terms:** Pilot, Payment Process (4.2/4.3 invoicing and automatic payment), Use Limitations, 1.6 Machine Learning, Increased Claims, Increased Cap Amount, Unlimited Claims.
  - **New:** 8.1 "**Except as provided in the Cover Page**, … not more than the General Cap Amount"; 8.2 "Except as provided in Section 8.4 … **or in the Cover Page**". A commit note says "the Supercap and Uncapped Claims are defined in the Key Terms" (S4, commit of 2026-09-17). So v3 moves those to the cover page under new names.
  - **New 9.1.c:** if the cover page leaves out Provider/Customer Covered Claims, that party has no indemnity duty. So both are truly optional.
  - 4.3: Customer pays "according to the terms in the Order Form" (payment terms now live only on the cover page).
- **Judgment call (owner):** ship v3 (matches our template word for word, but the incorporated URL is dead today), or swap the template to v2.1 (published, has an official cover page). I assume v3 below, and I follow the v2.1 cover page's order and wording wherever v3 still uses the term.

### Structure

The terms define the Cover Page as having an **Order Form** (business details, 13.23) and **Key Terms** (legal details, 13.21). The terms point at each by name ("as described in the Order Form", "Framework Terms = Standard Terms + Key Terms"). **So Parley's page should show two labeled parts, "Order Form" and "Key Terms"**, like the official one. That may need a group heading in `coverPage` (today it only has flat sections). Flag for T8.

Signatures: the official combined page has a sign block under each part. *(Parley)* One block at the end, with the closing: "By signing this Cover Page, each party agrees to enter into the Framework Terms and this Order Form." Flag as a judgment call.

Intro *(Parley, adapted from the official "USING THE FRAMEWORK TERMS" text, S1)*: "This Cover Page has an Order Form and Key Terms. The Framework Terms are the Key Terms below and the Common Paper Cloud Service Agreement Standard Terms Version 3.0, which are incorporated by reference. If there is any inconsistency, this Order Form controls for this Agreement, and the Key Terms control over the Standard Terms."

### Sections and fields (in official order)

**Part: Order Form**. Hint: "The business terms of this deal."

| # | Heading (hint) | Key · kind | Label | Help (≤15 words) | Options / default | Optional | Linked terms |
|---|---|---|---|---|---|---|---|
| 1 | Cloud Service ("What the customer is buying") | `cloudService` · longText | Cloud Service | Describe the product the customer gets. | Official line: "The Cloud Service available under this Order Form is {value}." No default | No | *none, see note A* |
| 2 | Order Date ("The date access to the Cloud Service starts", official hint) | `orderDate` · choice | Order Date | When the customer's access starts. | `lastSignature`: "Date of last signature on this Order Form" · `custom`: "{value}" with `date` ("Start date"). **Default `lastSignature`** (official "( x )") | No | Order Date |
| 3 | Subscription Period | `subscriptionPeriod` · duration | Subscription Period | How long each paid term lasts. | Default `{1, years}` (70% of CSAs use one year, S1/S13; official example "12 months") | No | Subscription Period, Subscription Periods |
| 4 | Cloud Service Fees | `fees` · longText | Cloud Service Fees | What the customer pays, and per what (year, user, …). | No default. Official shape: "[$ amount] per [year, month, Subscription Period, User, gigabyte, etc.]" or "Other fee structure". Help can say fees are in U.S. Dollars unless you name another currency (4.1) | No | *none, see note A* |
| 5 | Payment Process ("How billing works") | `paymentTerms` · longText | Payment terms | How and when the customer pays. | Default, built from the official words + benchmark: "Provider will invoice Customer annually. Customer will pay each invoice within 30 days from Customer's receipt of invoice." (62% use "30 days from receipt", S1) | No | *none, see note A* |
| 6 | Auto-renewal | `renewal` · choice | Renewal | Whether the order renews, and the notice needed to stop it. | `autoRenew`: "Non-Renewal Notice Date: At least {value} before the end of the current Subscription Period" with `duration` ("Notice period"). `noRenewal`: "Modifying Section 5.1 of the Standard Terms, this Order Form does not automatically renew and will expire at the end of the Subscription Period." **Default `autoRenew` {30, days}** (official "( x )"; 84% use 30 days, S1) | No | Non-Renewal Notice Date |
| 7 | Technical Support | `technicalSupport` · choice | Technical Support | What support the customer gets and how to ask. | `none`: "None" *(Parley)* · `described`: "{value}" with `longText` ("Support details"; official placeholder "Describe included support and/or how Customer can receive support"). Default `described`, empty | Official: optional (S1) | Technical Support |

**Part: Key Terms**. Hint: "The legal terms that govern every Order Form."

| # | Heading (hint) | Key · kind | Label | Help | Options / default | Optional | Linked terms |
|---|---|---|---|---|---|---|---|
| 8 | Effective Date ("The date the Framework Terms start", official) | `effectiveDate` · choice | Effective Date | When these legal terms start. Often the same as the Order Date. | `lastSignature`: "Date of last Cover Page signature" · `custom`: "{value}" with `date`. **Default `lastSignature`** (official "( x )") | No | Effective Date |
| 9 | Governing Law & Chosen Courts | `governingLaw` · jurisdiction | Governing law & courts | Which state's laws apply, and where lawsuits are filed. | Default state **DE** (71% of CSAs, S1). Line labels: "Governing Law" → `governingLaw.state`; "Chosen Courts" → `governingLaw.courtLocation`. Official Chosen Courts wording: "The courts (whether state, federal, or otherwise) located in [ … ]" | No | Governing Law → `.state`; Chosen Courts → `.courtLocation` |
| 10 | Covered Claims ("Claims covered by indemnity obligations", official) | `providerCoveredClaims` · choice | Provider Covered Claims | Claims the provider defends the customer against. | `standard`: "Any action, proceeding, or claim that the Cloud Service, when used by Customer according to the terms of the Agreement, violates, misappropriates, or otherwise infringes upon anyone else's intellectual property or other proprietary rights." · `custom`: "{value}" with `longText` · `none`: "None". **Default `standard`** (committee default; 76% keep it, S1) | Yes, legally (9.1.c) | Provider Covered Claims, Provider Covered Claim |
| 10 | (same section) | `customerCoveredClaims` · choice | Customer Covered Claims | Claims the customer defends the provider against. | `standard`: "Any action, proceeding, or claim that (1) the Customer Content, when used according to the terms of the Agreement, violates, misappropriates, or otherwise infringes upon anyone else's intellectual property or other proprietary rights; or (2) results from Customer's breach or alleged breach of Section 2.1 (Restrictions on Customer)." · `custom` · `none`. **Default `standard`** | Yes (9.1.c) | Customer Covered Claims, Customer Covered Claim |
| 11 | General Cap Amount ("Limitation of liability amount for most claims", official) | `generalCapAmount` · choice | General Cap Amount | The most either side can owe for most claims. | `feesMultiple1`: "1x the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim" · `feesMultiple2`: "2x the Fees paid or payable by …" (same tail) · `fixed`: "{value}" with `money` · `allowOther` for the hybrid ("The greater of $[ ] or [ ]x the Fees …"). **Default `feesMultiple1`** (85% pick a fees multiple at 1x, S1) | No. Deleting it means **no cap at all**, not $0 (S1) | General Cap Amount |
| 12 | Liability cap exceptions *(Parley heading)* | `capExceptions` · longText | Cap exceptions | Claims with a higher cap or no cap. Leave empty if none. | No default | Yes | *none, see note B* |
| 13 | DPA ("Data Processing Agreement", official) | `dpa` · choice | DPA | Your data processing agreement, if you have one. | `none`: "None" · `reference`: "{value}" with `text` (official placeholder "Attach or describe where to find."). **Default `none`** | Yes | DPA |
| 14 | Other Changes to Standard Terms ("List specific changes to the Standard Terms", official) | `modifications` · longText | Other changes | Any changes to the standard terms. Leave empty if none. | No default | Yes | — |
| — | Signatures | `provider`, `customer` · party | Provider / Customer | The company selling / buying the Cloud Service. | Notice Address (12.9) = party `address` ("Use email or postal address", official) | No | Provider → `provider.company`; Customer → `customer.company` |

Rule *(Parley)*: provider and customer must be different companies (same rule as the NDA).

**Note A: fields with no linked term.** `Cloud Service` (13.6 "the product described in the Order Form"), `Fees` (13.15 "the applicable amounts described in an Order Form") and payment terms (4.3) are **not** spans in the template, but the terms say the Order Form defines them. Without them the contract has no product and no price. I strongly recommend including them. Label the fees section **"Cloud Service Fees"** (the official label): the SLA uses "Cloud Service Fees" and CSA v3 never defines that phrase.

**Note B: `capExceptions`.** Not a span, but v3 8.1/8.2 say "except as provided in the Cover Page", and Common Paper plans "Supercap / Uncapped Claims" there. One optional longText keeps us faithful without guessing v3's unpublished wording. It could also just fold into `modifications`. Judgment call.

**Left out on purpose:** Pilot, Use Limitations, SLA, Professional Services, Security Policy, Insurance Minimums, Additional Warranties (all optional in v2.1, none linked in v3; users can use `modifications`). Prohibited Data (3.2 "unless authorized by the Order Form or Key Terms") has no span either; it is covered by `modifications`.

### CSA judgment calls to flag

1. **v3 vs v2.1** (above). Biggest one.
2. Effective Date / Order Date as a choice ("date of last signature") vs a plain date with today as default (what the NDA does). The official page uses the choice.
3. `jurisdiction` is US only. Common Paper allows "state, province, and/or country" for both Governing Law and Chosen Courts, and lets the court's state differ from the governing law's state. Non-US parties can't be served.
4. Hybrid cap and multiples other than 1x/2x fall back to "Other" text.
5. One signature block for Order Form + Key Terms.

---

## 2. Service Level Agreement (`templates/sla.md`, v2.0)

### What Common Paper does

The SLA is not a standalone contract. It is a **variable inside the CSA Order Form** ("SLA details will appear as a variable on a CSA Cover Page rather than as a standalone document", S7). The official cover page (S7, same in S6):

> This Order Form incorporates the Service Level Agreement Standard Terms available at https://commonpaper.com/standards/service-level-agreement/2.0/ with the below Variables.
> [ ] **Target Uptime**: [ ## ]%
> The **Uptime Credit** will be calculated as outlined in the table below: (Actual Uptime Percentage → Percentage of monthly Cloud Service Fee; 4 rows: "[#]% to Target Uptime", "[#]% to [#]%" ×2, "under [#]%")
> **Scheduled Downtime** means time periods where the Cloud Service is not available to **Customer**:
> ( ) because **Provider** is performing routine or scheduled maintenance during the following time windows: [start time] to [end time] [time zone] during [days of the week]
> ( ) following written notice (including by email, on the Cloud Service, or on **Provider's** website) given at least [number] [hours | days] before the period of unavailability.
> [ ] **Target Response Time**: [number] [minutes | hours | days]
> The **Response Time Credit** will be [__]% of the monthly Cloud Service Fee for each time Provider fails to meet the Target Response Time.
> **Support Channel**: [fill in how customers request support or file an incident ticket]

Both targets are optional checkboxes. "The SLA can be measured as an uptime percentage …, response time …, or both" (S7).

### Structure

Parley ships the SLA as its own document, so its page must say which agreement it adds to. *(Parley)* intro, modeled on the official AI Addendum wording (S11): "This Cover Page incorporates the Common Paper Service Level Agreement Standard Terms Version 2.0 with the Variables below. This SLA is incorporated into the following Agreement: {agreement}." Closing *(Parley)*: "By signing this Cover Page, each party agrees to this SLA."

### Sections and fields

| # | Heading (hint) | Key · kind | Label | Help | Options / default | Optional | Linked terms |
|---|---|---|---|---|---|---|---|
| 1 | Agreement *(Parley)* ("The contract this SLA adds to") | `agreement` · text | Agreement | The Cloud Service Agreement this SLA belongs to. | Placeholder like the official AI one: "Cloud Service Agreement between Acme, Inc. and Beta LLC dated January 1, 2026" | No | *none (judgment call)* |
| 2 | Subscription Period | `subscriptionPeriod` · choice | Subscription Period | The paid term from your Order Form. | `orderForm`: "As set in the Order Form" *(Parley)* · `custom`: "{value}" with `duration`. **Default `orderForm`** | No | Subscription Period |
| 3 | Target Uptime ("Uptime commitment, measured each month") | `targetUptime` · choice | Target Uptime | The share of each month the service must be up. | `none`: "None" · `target`: "{value}" with `percent`. **Default `target` 99.9** (the annotated example works out to 99.9%; the range is 98% lenient to 99.999% strong, S7) | Yes (checkbox) | Target Uptime |
| 4 | Uptime Credit ("Credit when uptime falls short") | `uptimeCredit` · **longText (stop-gap)** | Uptime Credit | Credit per month, by how far uptime fell short. | Default *(Parley)*: "99.0% to Target Uptime: 5% of the monthly Cloud Service Fee. 95.0% to 99.0%: 10%. Under 95.0%: 20%." Must respect the 8% per-Subscription-Period cap in 3.3 (it caps the total, so higher tiers are fine). **Needs owner/legal pick** | Required when `targetUptime` ≠ none | Uptime Credit |
| 5 | Scheduled Downtime ("Downtime that doesn't count against uptime") | `scheduledDowntime` · choice | Scheduled Downtime | When planned maintenance is allowed. | `window`: "because Provider is performing routine or scheduled maintenance during the following time windows: {value}" with `text` (e.g. "12:00 a.m. to 4:00 a.m. Pacific Time during Saturdays and Sundays") · `notice`: "following written notice (including by email, on the Cloud Service, or on Provider's website) given at least {value} before the period of unavailability." with `duration`. **Default `notice` {2, days}** *(Parley default)* | Required when `targetUptime` ≠ none | Scheduled Downtime |
| 6 | Target Response Time ("How fast support replies") | `targetResponseTime` · choice | Target Response Time | How fast the provider must answer a support request. | `none`: "None" · `target`: "{value}" with `duration`. **Default `target` {1, days}** (range: 30 minutes strong to 2 days lenient, S7) | Yes (checkbox) | Target Response Time |
| 7 | Response Time Credit | `responseTimeCredit` · percent | Response Time Credit | Credit for each late support reply. | Render with the official sentence: "The Response Time Credit will be {value} of the monthly Cloud Service Fee for each time Provider fails to meet the Target Response Time." Default **2** *(Parley)* | Required when `targetResponseTime` ≠ none | Response Time Credit |
| 8 | Support Channel | `supportChannel` · text | Support Channel | Where the customer sends support requests. | Official examples: "send an email to support@companyname.com", "visit www.companyname.com/helpdesk and submit a ticket" (S7). No default | Required when `targetResponseTime` ≠ none | Support Channel |
| — | Signatures | `provider`, `customer` · party | Provider / Customer | — | — | No | Provider, Customer |

Rules *(Parley)*: at least one of `targetUptime` / `targetResponseTime` is not `none`, or the SLA does nothing. Conditional required fields as noted. Parties must differ.

### SLA gaps and judgment calls

1. **Target Uptime needs 3 decimals.** `percent` allows 2, but Common Paper's own "strong" example is 99.999% (S7). Change `percent` to 3 decimals (or give this field `decimals: 3`).
2. **Target Response Time needs minutes.** Common Paper's units are minutes | hours | days (S7), and the strong example is "30 minutes". `duration` has no `minutes`. Add a `minutes` unit (hours and days already exist).
3. **Uptime Credit is a table** (tiers of uptime range → % of monthly fee). No Parley kind fits. Best: a new `tiers` kind (rows of {from %, to %, credit %}, ranges checked). Stop-gap: longText with a default.
4. **Response Time Credit sentence:** a bare `percent` renders "2%". The official line wraps it in a sentence, so the cover page needs a line template for a scalar ("… will be {value} of …"), like choice labels have.
5. **Subscription Period & Agreement:** the SLA's terms lean on the CSA ("Order Form", "Cloud Service Fees", "Force Majeure Event", "Agreement"). As a standalone Parley doc it must name the CSA it belongs to. Better long term: offer the SLA as an optional section of the CSA cover page, the way Common Paper does.
6. SLA 2.0 was written for CSA v2. With CSA v3, "Cloud Service Fees" is only defined if the CSA page labels its fees that way (see CSA note A).
7. The maintenance window is 4 values (start, end, time zone, days) in one `text` field. That's fine for now.
8. All credit defaults (5/10/20%, 2%, 2-day notice) are Parley's, not Common Paper's. Common Paper leaves them blank.

---

## 3. AI Addendum (`templates/AI-Addendum.md`, v1.0)

### What Common Paper does

The official standalone cover page (S11) has, in order:

1. Intro: "This Cover Page incorporates the AI Addendum Standard Terms available at https://commonpaper.com/standards/ai-addendum/1.0/ with the Variables set forth below (collectively, the "AI Addendum"). … This AI Addendum amends and is incorporated into the following "Agreement": [ insert description of Agreement ]. Undefined capitalized words have the meanings or descriptions given in the Agreement. If there is any inconsistency between this AI Addendum and the Agreement, the AI Addendum will control for the provision of AI Services."
2. **Training Data**: multi-select checkboxes.
3. **Training Purposes**, subtitle "Permitted Model Training".
4. **Training Restrictions**, subtitle "Restrictions on Model Training". Multi-select, optional.
5. **Improvement Restrictions**, subtitle "For improvements to the AI System (but not any Models)". Multi-select, optional.
6. Covered Claims (AI-specific; optional) and 7. AI Acceptable Use Policy (optional). **Neither is a linked term** in our template.
8. "By signing this Cover Page, each party agrees to enter into this AI Addendum." + Provider/Customer sign block (Signature, Print Name, Title, Notice Address, Date).

It works with the CSA or the Software License Agreement (S10).

### Sections and fields

| # | Heading (hint, official subtitle) | Key · kind | Label | Help | Options (exact official wording) / default | Optional | Linked terms |
|---|---|---|---|---|---|---|---|
| 1 | Agreement ("The contract this addendum amends") | `agreement` · text | Agreement | The CSA or software license this addendum changes. | Official example: "Cloud Service Agreement between Rose Apothecaries, Inc. and Vandelay Industries, Inc. dated January 1, 2025" | No | *none (official field)* |
| 2 | Training Data | `trainingData` · **multi-select (missing kind)** | Training Data | Which customer data the provider may train models on. | Exclusive `none`: "None". Else, lead-in "Provider may Train the Model(s) using the following Training Data:" + any of: "Usage Data" · "Feedback" · "Input" · "Output" · "User prompts, excluding other components of Input" · "Customer Content" · Other (free text). **Default `none`** (the standard's default is no training, 1.3; official drafting note) | No (None is an answer) | Training Data |
| 3 | Training Purposes ("Permitted Model Training") | `trainingPurposes` · choice | Training Purposes | What the trained models may be used for. | `none`: "None" · `customerOnly`: "Train the Model(s) in the AI Services solely for Customer's benefit" · `general`: "Train the Model(s) in the AI Services". Lead-in: "Provider may use Training Data for the following purpose:". **Default `none`** | No | Training Purposes |
| 4 | Training Restrictions ("Restrictions on Model Training") | `trainingRestrictions` · **multi-select** | Training Restrictions | Steps the provider must take before training. | Any of: "Training Data must be aggregated" · "Training Data must be de-identified" · "Provider will use commercially reasonable efforts consistent with industry standard technology to de-identify Training Data" · Other. Empty prints "None". **Default: none selected** | Yes (official: "optional variable") | Training Restrictions |
| 5 | Improvement Restrictions ("For improvements to the AI System (but not any Models)") | `improvementRestrictions` · **multi-select** | Improvement Restrictions | Limits on using customer data to improve the product. | Any of: "Neither Input nor Output may identify Customer" · "Improvements based on Customer's Input, Output, or Training Data will be solely for Customer's benefit" · Other. Empty prints "None". **Default: none selected** | Yes | Improvement Restrictions |
| — | Signatures | `provider`, `customer` · party | Provider / Customer | — | — | No | Provider → `provider.company`, Customer → `customer.company` |

Rules *(Parley)*:
- `trainingData` is `none` **if and only if** `trainingPurposes` is `none`. 1.3 allows training only when the Cover Page "identifies Training Data **and** Training Purposes". One without the other is a trap.
- If training is `none`, `trainingRestrictions` should be empty (or hidden).
- Parties must differ.

**Left out on purpose:** the AI-specific Covered Claims and the AI Acceptable Use Policy rows (no spans in our template). The AI Covered Claims rows expand the *underlying* agreement's indemnity, so they would need care. A later version could add them as optional longText with the official default text from S11.

### AI Addendum gaps and judgment calls

1. **Multi-select is needed** for Training Data, Training Restrictions and Improvement Restrictions. The official page uses checkboxes: "pick none, one, or more than one". Spec §2 point 4 already names "choice (single or multiple, with an optional 'other' text)", but `fields.ts` only has single. Proposed shape: `field.choice({ multiple: true, exclusive: ["none"], … })` → value `{ options: string[], other?: string }`, printed as a list.
   - Stop-gap without it: `choice` { `none`: "None", `listed`: "{value}" with `longText` }. That loses the official checkbox wording.
2. **Training Purposes:** the two non-None options overlap ("solely for Customer's benefit" is narrower). Single-select is right. Common Paper uses checkboxes here too, but picking both makes no sense.
3. **Default = no training** matches the standard. A provider who wants training must opt in on both fields.
4. The "Agreement" description is plain text. If Parley later links documents, it could point at a Parley CSA draft.

---

## Summary: kinds Parley lacks

| Need | Where | Why | Suggested fix |
|---|---|---|---|
| **Multi-select** (+ exclusive "None", + Other) | AI: Training Data, Training Restrictions, Improvement Restrictions | The official page uses checkboxes ("pick none, one, or more than one") | `choice` with `multiple: true` (already in spec §2) |
| **Tier table** | SLA: Uptime Credit | The official page has a 4-row table: uptime range → % credit | New `tiers` kind; stop-gap longText |
| **3-decimal percent** | SLA: Target Uptime | 99.999% is Common Paper's own example | `percent` decimals option |
| **`minutes` duration unit** | SLA: Target Response Time | Official units are minutes / hours / days | Add `minutes` to `duration` |
| **Number / multiplier** | CSA: General Cap Amount ("[N]x the Fees") | The official option has a free multiple | Fixed 1x/2x options + Other for now; a `number` kind later |
| Non-US jurisdiction | CSA: Governing Law / Chosen Courts | Official allows "state, province, and/or country"; court and law may differ | Out of scope for launch; note it |
| Scalar line template | SLA: Response Time Credit sentence | Official sentence wraps the percent | Cover-page line `text: "… {value} …"` |
| Group headings | CSA: "Order Form" / "Key Terms" parts | The terms refer to these parts by name | `coverPage` group heading |
