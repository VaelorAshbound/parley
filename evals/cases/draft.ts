import type { DocumentId } from "@workspace/documents"

// Drafting a whole agreement by chat (spec §6), one for each agreement
// beside the NDA (its own cases are in nda.ts). The chat picks the agreement
// from the opening, then the simulated user answers what the AI asks, from
// the facts only. `expect` is what those fields must end up holding: only
// values the facts state plainly, not free text the model words itself.

export type DraftCase = {
  name: string
  document: DocumentId
  opening: string
  facts: string
  expect: Record<string, unknown>
}

/** Where the facts stop, the user takes the usual choice. */
const REST =
  "- Anything else: take Parley's suggestion, or the standard option (or none, where that is a choice)."

export const draftCases: DraftCase[] = [
  {
    name: "CSA for a forecasting dashboard",
    document: "csa",
    opening:
      "We're Northwind Analytics. Juniper Outfitters wants to buy a yearly subscription to our hosted sales forecasting dashboard.",
    facts: `- Provider: Northwind Analytics, Inc. Signer: Priya Raman, Chief Revenue Officer. Email, for notices too: priya@northwind.test.
- Customer: Juniper Outfitters LLC. Signer: Marco Silva, VP of Operations. Email, for notices too: marco@juniper.test.
- The product: Northwind Insights, a hosted sales forecasting dashboard.
- Access starts on the date of the last signature. No pilot.
- Each term is 12 months. Fees: $48,000 per year, billed by invoice once a year, paid within 30 days of receiving it.
- It renews automatically unless a party gives 30 days' notice.
- Up to 50 users. Email support on business days. No SLA. No professional services.
- Delaware law, courts in New Castle County.
- The general liability cap: 1 times the fees of the last 12 months.
${REST}`,
    expect: {
      provider: {
        company: "Northwind Analytics, Inc.",
        name: "Priya Raman",
        title: "Chief Revenue Officer",
        email: "priya@northwind.test",
      },
      customer: {
        company: "Juniper Outfitters LLC",
        name: "Marco Silva",
        title: "VP of Operations",
        email: "marco@juniper.test",
      },
      pilot: { option: "none" },
      subscriptionPeriod: { amount: 12, unit: "months" },
      renewal: { option: "autoRenew", value: 30 },
      sla: { option: "none" },
      governingLaw: { state: "DE", courtLocation: "New Castle County" },
      generalCapAmount: { option: "multiple", value: 1 },
    },
  },
  {
    name: "SLA with an uptime target",
    document: "sla",
    opening:
      "Juniper Outfitters buys our cloud dashboard under a Cloud Service Agreement. Now they want an SLA: an uptime target, with credits when we miss it.",
    facts: `- The SLA adds to the Order Form dated November 1, 2026 under the Cloud Service Agreement between Northwind Analytics, Inc. and Juniper Outfitters LLC.
- Provider: Northwind Analytics, Inc. Signer: Priya Raman, Chief Revenue Officer. Email, for notices too: priya@northwind.test.
- Customer: Juniper Outfitters LLC. Signer: Marco Silva, VP of Operations. Email, for notices too: marco@juniper.test.
- Only an uptime target: 99.9%. No scheduled downtime is excluded. No support response target.
- Uptime credits: 5% from 99.0% up to the target, 10% from 95.0% to 99.0%, 20% under 95.0%.
${REST}`,
    expect: {
      provider: {
        company: "Northwind Analytics, Inc.",
        name: "Priya Raman",
        title: "Chief Revenue Officer",
        email: "priya@northwind.test",
      },
      customer: {
        company: "Juniper Outfitters LLC",
        name: "Marco Silva",
        title: "VP of Operations",
        email: "marco@juniper.test",
      },
      targets: {
        selected: [
          {
            option: "uptime",
            value: { target: 99.9, downtime: { option: "none" } },
          },
        ],
      },
    },
  },
  {
    name: "DPA for patient insights",
    document: "dpa",
    opening:
      "Our customer Lumen Clinics runs clinics in Germany and the UK, and needs a GDPR data processing agreement with us. We process their patients' and staff's personal data in our analytics service.",
    facts: `- The DPA adds to the Cloud Service Agreement between Northwind Health Analytics, Inc. and Lumen Clinics GmbH, dated October 1, 2026.
- Customer: Lumen Clinics GmbH, the controller of the data, at Torstrasse 12, 10119 Berlin, Germany. Signer: Lena Vogel, Data Protection Officer. Email, for notices too: lena@lumen.test.
- Provider: Northwind Health Analytics, Inc., at 500 Howard St, San Francisco, CA 94105. Signer: Omar Haddad, General Counsel. Email, for notices too: omar@northwind.test. Security contact: security@northwind.test.
- The service: Northwind Patient Insights.
- Subprocessors: listed in the DPA. Just one: Stratus Cloud Hosting, Inc., in Germany, for hosting.
- Whose data: the clinics' patients (end users) and employees. What data: names and contact details.
- Special category data: yes, health data, protected by the provider's security policy.
- The provider receives, stores, uses (analyzes) and erases the data. The customer sends it continuously.
- The EU transfer clauses follow the law of Ireland. UK transfers: England and Wales.
${REST}`,
    expect: {
      customer: {
        company: "Lumen Clinics GmbH",
        name: "Lena Vogel",
        title: "Data Protection Officer",
        email: "lena@lumen.test",
      },
      provider: {
        company: "Northwind Health Analytics, Inc.",
        name: "Omar Haddad",
        title: "General Counsel",
        email: "omar@northwind.test",
      },
      customerRole: "controller",
      approvedSubprocessors: { option: "listed" },
      specialCategoryData: { option: "yes" },
      governingMemberState: "IE",
      ukTransfers: "englandWales",
    },
  },
  {
    name: "AI Addendum with no training",
    document: "ai-addendum",
    opening:
      "Juniper Outfitters uses our cloud dashboard under a CSA, and we just added AI features. They want an AI addendum that says we never train our models on their data.",
    facts: `- The addendum changes the Cloud Service Agreement between Northwind Analytics, Inc. and Juniper Outfitters LLC, dated November 1, 2026.
- Provider: Northwind Analytics, Inc. Signer: Priya Raman, Chief Revenue Officer. Email, for notices too: priya@northwind.test.
- Customer: Juniper Outfitters LLC. Signer: Marco Silva, VP of Operations. Email, for notices too: marco@juniper.test.
- No customer data may be used to train models, for any purpose.
- The Provider defends the Customer against AI claims (the standard provider claims). The Customer defends no one.
- No AI acceptable use policy.
${REST}`,
    expect: {
      provider: {
        company: "Northwind Analytics, Inc.",
        name: "Priya Raman",
        title: "Chief Revenue Officer",
        email: "priya@northwind.test",
      },
      customer: {
        company: "Juniper Outfitters LLC",
        name: "Marco Silva",
        title: "VP of Operations",
        email: "marco@juniper.test",
      },
      trainingData: { selected: [{ option: "none" }] },
      trainingPurposes: { option: "none" },
      coveredClaims: { selected: [{ option: "provider" }] },
      acceptableUsePolicy: { option: "none" },
    },
  },
  {
    name: "free 60-day pilot",
    document: "pilot-agreement",
    opening:
      "Harbor Health wants to try our staff scheduling app, Slotwise, for free for 60 days before they decide to buy.",
    facts: `- Provider: Slotwise Inc. Signer: Dana Kim, CEO. Email, for notices too: dana@slotwise.test.
- Customer: Harbor Health, Inc. Signer: Hugo Lind, VP of Operations. Email, for notices too: hugo@harborhealth.test.
- The product: Slotwise, a staff scheduling web app.
- It starts on the date of the last signature and lasts 60 days. It is free.
- Texas law, courts in Travis County.
- The general liability cap: a fixed $100,000.
- No DPA, no technical support terms, no changes to the standard terms.
${REST}`,
    expect: {
      provider: {
        company: "Slotwise Inc.",
        name: "Dana Kim",
        title: "CEO",
        email: "dana@slotwise.test",
      },
      customer: {
        company: "Harbor Health, Inc.",
        name: "Hugo Lind",
        title: "VP of Operations",
        email: "hugo@harborhealth.test",
      },
      effectiveDate: { option: "lastSignature" },
      pilotPeriod: { amount: 60, unit: "days" },
      fees: { option: "free" },
      governingLaw: { state: "TX", courtLocation: "Travis County" },
      generalCap: {
        option: "fixed",
        value: { amount: 100_000, currency: "USD" },
      },
    },
  },
  {
    name: "design partner for a beta",
    document: "design-partner-agreement",
    opening:
      "We're giving Corner Market early access to Shelf Sense, our unreleased inventory tool, in exchange for regular feedback.",
    facts: `- Provider: Acme Analytics, Inc. Signer: Ana Diaz, CEO. Email, for notices too: ana@acme.test.
- Partner: Corner Market Co. Signer: Cy Park, Owner. Email, for notices too: cy@cornermarket.test.
- The product: Shelf Sense, an early inventory planning tool for retail stores.
- The partner gives feedback in 2 sessions per month, and agrees to be a reference customer. Nothing else.
- In return the provider gives a 20% discount when the product launches.
- The partner pays nothing. The program lasts 6 months.
- New York law, courts in New York County.
${REST}`,
    expect: {
      provider: {
        company: "Acme Analytics, Inc.",
        name: "Ana Diaz",
        title: "CEO",
        email: "ana@acme.test",
      },
      partner: {
        company: "Corner Market Co.",
        name: "Cy Park",
        title: "Owner",
        email: "cy@cornermarket.test",
      },
      programPartner: {
        selected: [
          { option: "feedback", value: { sessions: 2, period: "month" } },
          { option: "reference" },
        ],
      },
      fees: { option: "none" },
      term: { amount: 6, unit: "months" },
      governingLaw: { state: "NY", courtLocation: "New York County" },
    },
  },
  {
    name: "PSA for a portal redesign",
    document: "psa",
    opening:
      "We're Harbor Health. We're hiring the agency Northwind Studio to redesign our patient portal, paid by milestones.",
    facts: `- Provider: Northwind Studio LLC. Signer: Nora Patel, Managing Partner. Email, for notices too: nora@northwindstudio.test.
- Customer: Harbor Health, Inc. Signer: Hugo Lind, VP of Operations. Email, for notices too: hugo@harborhealth.test.
- Services: research, design and front-end build of the new patient portal, launched within 4 months.
- Deliverables: a design system and the portal's front-end code. Harbor Health owns them once it has paid for them.
- No third-party materials.
- Fees: $180,000 in four milestone payments of $45,000. Invoices after each milestone, paid within 30 days of receipt.
- The SOW starts on the date of the last signature and lasts 6 months.
- Oregon law, courts in Multnomah County.
- The general liability cap: 1 times the fees.
${REST}`,
    expect: {
      provider: {
        company: "Northwind Studio LLC",
        name: "Nora Patel",
        title: "Managing Partner",
        email: "nora@northwindstudio.test",
      },
      customer: {
        company: "Harbor Health, Inc.",
        name: "Hugo Lind",
        title: "VP of Operations",
        email: "hugo@harborhealth.test",
      },
      timeOfAssignment: { option: "uponPayment" },
      thirdPartyMaterials: { option: "none" },
      invoicePeriod: { option: "afterMilestone" },
      paymentPeriod: { option: "receipt", value: { amount: 30, unit: "days" } },
      sowTerm: { option: "fixed", value: { amount: 6, unit: "months" } },
      governingLaw: { state: "OR", courtLocation: "Multnomah County" },
      generalCapAmount: { option: "multiple", value: 1 },
    },
  },
  {
    name: "on-premise license for a bank",
    document: "software-license-agreement",
    opening:
      "First Harbor Bank wants to license our fraud detection software and run it on its own servers, not in our cloud.",
    facts: `- Provider: Quill Labs, Inc. Signer: Quinn Adeyemi, Chief Revenue Officer. Email, for notices too: quinn@quill.test.
- Customer: First Harbor Bank, N.A. Signer: Mara Vogel, Head of Fraud Operations. Email, for notices too: mara@firstharbor.test.
- The software: Quill Sentinel, on-premises fraud detection software.
- The order date is the date of the last signature. Each subscription period is 12 months. Fees: $120,000 per year.
- Paid by invoice once a year, within 30 days of receiving it.
- It renews automatically unless a party gives 60 days' notice.
- For the bank's own internal use only. Warranty: 90 days from delivery.
- New York law, courts in New York County.
- The general liability cap: 1 times the fees of the last 12 months.
${REST}`,
    expect: {
      provider: {
        company: "Quill Labs, Inc.",
        name: "Quinn Adeyemi",
        title: "Chief Revenue Officer",
        email: "quinn@quill.test",
      },
      customer: {
        company: "First Harbor Bank, N.A.",
        name: "Mara Vogel",
        title: "Head of Fraud Operations",
        email: "mara@firstharbor.test",
      },
      subscriptionPeriod: { amount: 12, unit: "months" },
      autoRenewal: { option: "notice", value: { amount: 60, unit: "days" } },
      permittedUses: { option: "internal" },
      warrantyPeriod: {
        option: "fromDelivery",
        value: { amount: 90, unit: "days" },
      },
      governingLaw: { state: "NY", courtLocation: "New York County" },
      generalCapAmount: { option: "multiple", value: 1 },
    },
  },
  {
    name: "referral partnership",
    document: "partnership-agreement",
    opening:
      "We're Acme Analytics. We and Maple Retail Group want a partnership agreement: each of us refers customers to the other, with set duties.",
    facts: `- Company: Acme Analytics, Inc. Signer: Ana Diaz, CEO. Email, for notices too: ana@acme.test.
- Partner: Maple Retail Group Ltd. Signer: Dee Singh, Head of Alliances. Email, for notices too: dee@maple.test.
- Each side refers customers to the other. No money changes hands, so no payment process or schedule.
- Worldwide. It starts on the date of the last signature and ends 1 year after that.
- California law, courts in San Francisco County.
- The general liability cap: a fixed $50,000. No increased or unlimited claims.
${REST}`,
    expect: {
      company: {
        company: "Acme Analytics, Inc.",
        name: "Ana Diaz",
        title: "CEO",
        email: "ana@acme.test",
      },
      partner: {
        company: "Maple Retail Group Ltd.",
        name: "Dee Singh",
        title: "Head of Alliances",
        email: "dee@maple.test",
      },
      territory: { option: "worldwide" },
      paymentSchedule: { option: "none" },
      endDate: {
        option: "afterEffective",
        value: { amount: 1, unit: "years" },
      },
      governingLaw: { state: "CA", courtLocation: "San Francisco County" },
      generalCap: {
        option: "fixed",
        value: { amount: 50_000, currency: "USD" },
      },
    },
  },
  {
    name: "BAA for a clinic's records",
    document: "baa",
    opening:
      "We host patient records for Maple Valley Clinic under our service contract. They need us to sign a HIPAA business associate agreement.",
    facts: `- The BAA is part of the Cloud Service Agreement between Cedar Care Records, Inc. and Maple Valley Clinic, P.C., dated October 1, 2026.
- Provider: Cedar Care Records, Inc., a business associate. Signer: Priya Raman, Chief Privacy Officer. Email, for notices too: priya@cedarcare.test.
- Company: Maple Valley Clinic, P.C., a covered entity. Signer: Sam Okafor, Medical Director. Email, for notices too: sam@maplevalley.test.
- A breach must be reported within 5 business days.
- The provider keeps no designated record set.
- The provider may use subcontractors with no extra limits. PHI never leaves the United States. No de-identification. No aggregation.
- It starts on the date of the last signature.
${REST}`,
    expect: {
      provider: {
        company: "Cedar Care Records, Inc.",
        name: "Priya Raman",
        title: "Chief Privacy Officer",
        email: "priya@cedarcare.test",
      },
      company: {
        company: "Maple Valley Clinic, P.C.",
        name: "Sam Okafor",
        title: "Medical Director",
        email: "sam@maplevalley.test",
      },
      providerRole: "businessAssociate",
      companyRole: "coveredEntity",
      breachNotificationPeriod: { amount: 5, unit: "businessDays" },
      designatedRecordSet: { option: "doesNotMaintain" },
      offshoring: { option: "never" },
      deidentification: { option: "never" },
    },
  },
]
