import type { DocumentDefinition } from "../src/define.ts"
import { definitions } from "../src/definitions/index.ts"

// A fully filled example of each document: the definition tests render them,
// and the output tests (T12) snapshot them.
export const examples = {
  "mutual-nda": {
    purpose:
      "Evaluating a possible partnership to resell Acme's analytics product.",
    effectiveDate: "2026-10-01",
    mndaTerm: { option: "expires", value: { amount: 2, unit: "years" } },
    confidentialityTerm: {
      option: "fixed",
      value: { amount: 3, unit: "years" },
    },
    governingLaw: { state: "DE", courtLocation: "New Castle" },
    modifications: "Section 3(d) does not apply to source code.",
    party1: {
      company: "Acme Analytics, Inc.",
      name: "Ana Diaz",
      title: "CEO",
      email: "legal@acme.test",
    },
    party2: {
      company: "Bolt Retail LLC",
      name: "Bo Chen",
      title: "Head of Partnerships",
      address: "100 Market St, San Francisco, CA 94105",
    },
  },
  psa: {
    provider: {
      company: "Northwind Studio LLC",
      name: "Nora Patel",
      title: "Managing Partner",
      email: "contracts@northwind.test",
    },
    customer: {
      company: "Harbor Health, Inc.",
      name: "Hugo Lind",
      title: "VP of Operations",
      email: "legal@harborhealth.test",
      address: "22 Pier Ave, Portland, OR 97209",
    },
    services:
      "Redesign of Harbor Health's patient portal: research, design and front-end build. Lead designer: Nora Patel. Kickoff within 2 weeks; launch within 4 months.",
    deliverables: {
      option: "listed",
      value:
        "Research report, design system, clickable prototype and the front-end source code of the new portal.",
    },
    deliverableTerms: {
      selected: [{ option: "drafts" }, { option: "acceptance" }],
    },
    rejectionPeriod: { amount: 10, unit: "businessDays" },
    resubmissionPeriod: { amount: 10, unit: "businessDays" },
    timeOfAssignment: { option: "uponPayment" },
    thirdPartyMaterials: { option: "providerProcures" },
    fees: "USD 180,000, billed in four milestone payments of USD 45,000.",
    travelExpenses:
      "Customer reimburses pre-approved travel at cost, up to USD 5,000 in total.",
    paymentPeriod: { option: "receipt", value: { amount: 30, unit: "days" } },
    invoicePeriod: { option: "afterMilestone" },
    sowDate: { option: "custom", value: "2026-10-05" },
    sowTerm: { option: "fixed", value: { amount: 6, unit: "months" } },
    customerObligations:
      "Name one product owner and give Provider access to the staging servers within 5 days of the SOW Date.",
    sowChanges:
      "Section 1.5 does not apply: Provider may not use Subcontractors.",
    effectiveDate: { option: "lastSignature" },
    governingLaw: { state: "OR", courtLocation: "Multnomah County, Oregon" },
    providerCoveredClaims: { option: "standard" },
    customerCoveredClaims: { option: "standard" },
    generalCapAmount: {
      option: "greater",
      value: { amount: { amount: 250000, currency: "USD" }, multiple: 1 },
    },
    increasedClaims: {
      selected: [{ option: "privacySecurity" }, { option: "confidentiality" }],
    },
    increasedCapAmount: { option: "multiple", value: 3 },
    unlimitedClaims: {
      selected: [{ option: "grossNegligence" }],
      other: "Breach of the HIPAA Business Associate Agreement.",
    },
    providerWarranties:
      "The portal will meet WCAG 2.2 AA accessibility guidelines at launch.",
    customerWarranties:
      "Customer has the rights to all content it gives Provider for the portal.",
    providerInsurance: {
      selected: [
        {
          option: "generalLiability",
          value: {
            occurrence: { amount: 1000000, currency: "USD" },
            aggregate: { amount: 2000000, currency: "USD" },
          },
        },
        {
          option: "cyberLiability",
          value: {
            occurrence: { amount: 2000000, currency: "USD" },
            aggregate: { amount: 2000000, currency: "USD" },
          },
        },
        { option: "insuredCyberLiability" },
      ],
    },
    customerInsurance: { selected: [{ option: "workersCompensation" }] },
    dpa: "The Common Paper DPA the parties signed on October 1, 2026.",
    customerPolicies:
      "Harbor Health Vendor Code of Conduct at https://harborhealth.test/vendors.",
    securityPolicy: "https://northwind.test/security",
    securityCertifications: {
      selected: [{ option: "soc2Type2" }, { option: "penetrationTesting" }],
    },
    publicityRights: { selected: [{ option: "nonPublic" }] },
    otherChanges: "Notices by email must copy notices@harborhealth.test.",
  },
  "software-license-agreement": {
    provider: {
      company: "Quill Robotics, Inc.",
      name: "Quinn Adeyemi",
      title: "Chief Revenue Officer",
      email: "legal@quill.test",
    },
    customer: {
      company: "Meridian Foods GmbH",
      name: "Mara Vogel",
      title: "Head of Plant Operations",
      email: "einkauf@meridian.test",
      address: "Hafenstrasse 12, 20457 Hamburg, Germany",
    },
    software:
      "Quill Vision 4, the on-premises inspection software for packing lines, with its Documentation",
    orderDate: { option: "custom", value: "2026-11-01" },
    subscriptionPeriod: { amount: 12, unit: "months" },
    fees: "EUR 48,000 per Subscription Period for up to 6 packing lines, plus EUR 6,000 per extra line.",
    feeTerms: {
      selected: [
        { option: "increaseUpTo", value: 5 },
        { option: "includeTaxes" },
      ],
    },
    paymentProcess: {
      option: "invoice",
      value: {
        frequency: { option: "annually" },
        days: { amount: 30, unit: "days" },
        from: { option: "receipt" },
      },
    },
    autoRenewal: { option: "notice", value: { amount: 60, unit: "days" } },
    permittedUses: { option: "withAffiliates" },
    additionalPermittedUses:
      "Running the Software on inspection cameras that Meridian's contract packers operate for Meridian.",
    licenseLimits: "Up to 6 packing lines in the European Union.",
    warrantyPeriod: {
      option: "fromUpdates",
      value: { amount: 90, unit: "days" },
    },
    deletionProcedure: {
      selected: [
        { option: "disableKeys" },
        { option: "uninstall" },
        { option: "certify" },
      ],
      other: "Customer will delete all local model files within 30 days.",
    },
    complianceVerification: { option: "standard" },
    services:
      "Email support on business days, 9:00 to 17:00 CET, and quarterly on-site tuning.",
    orderFormChanges: "Section 1.6 applies to major versions too.",
    effectiveDate: { option: "lastSignature" },
    governingLaw: {
      region: "Ontario, Canada",
      courtLocation: "Toronto, Ontario",
    },
    providerCoveredClaims: { option: "standard" },
    customerCoveredClaims: { option: "standard" },
    generalCapAmount: { option: "multiple", value: 1 },
    increasedClaims: { selected: [{ option: "confidentiality" }] },
    increasedCapAmount: {
      option: "greater",
      value: { amount: { amount: 500000, currency: "EUR" }, multiple: 3 },
    },
    unlimitedClaims: {
      selected: [{ option: "indemnification" }, { option: "licenseBreach" }],
    },
    providerWarranties:
      "The Software does not contain any code that sends Customer data outside Customer's network.",
    customerWarranties:
      "Customer will run the Software only on hardware that meets the Documentation.",
    dpa: "Not needed: the Software processes no personal data.",
    otherChanges:
      "Notices must also be sent by email to both notice addresses.",
  },
  "pilot-agreement": {
    product:
      "Forecast Cloud, Acme's demand forecasting web app, with its reporting API",
    effectiveDate: { option: "custom", value: "2026-10-01" },
    pilotPeriod: { amount: 3, unit: "months" },
    fees: { option: "paid", value: "$5,000 for the Pilot Period" },
    paymentProcess: {
      option: "invoice",
      value: { days: 30, start: { option: "receipt" } },
    },
    governingLaw: {
      state: "CA",
      courtLocation: "San Francisco County, California",
    },
    generalCap: {
      option: "greater",
      value: { amount: { amount: 50_000, currency: "USD" }, multiple: 2 },
    },
    dpa: "Acme's Data Processing Agreement at https://acme.test/dpa",
    technicalSupport:
      "Email support@acme.test on business days; Acme replies within one business day.",
    modifications:
      "Customer may share pilot results with its board under Section 6.",
    provider: {
      company: "Acme Analytics, Inc.",
      name: "Ana Diaz",
      title: "CEO",
      email: "legal@acme.test",
    },
    customer: {
      company: "Bolt Retail LLC",
      name: "Bo Chen",
      title: "VP of Operations",
      email: "contracts@bolt.test",
      address: "100 Market St, San Francisco, CA 94105",
    },
  },
  "design-partner-agreement": {
    product:
      "Shelf Sense, Acme's early-stage inventory planning tool for retail stores",
    programPartner: {
      selected: [
        {
          option: "feedback",
          value: { sessions: 2, period: { option: "month" } },
        },
        { option: "privateLists" },
        { option: "reference" },
      ],
      other: "Share anonymized sales data from two pilot stores",
    },
    programProvider: {
      selected: [
        { option: "discount", value: "20%" },
        {
          option: "functionality",
          value: "A weekly reorder report that exports to CSV",
        },
      ],
    },
    effectiveDate: { option: "lastSignature" },
    term: { amount: 6, unit: "months" },
    governingLaw: { state: "NY", courtLocation: "New York County, New York" },
    fees: {
      option: "paid",
      value: {
        amount: { amount: 500, currency: "USD" },
        period: { option: "month" },
        days: 30,
      },
    },
    modifications:
      "Provider will not name Partner in public before the Product launches.",
    provider: {
      company: "Acme Analytics, Inc.",
      name: "Ana Diaz",
      title: "CEO",
      email: "legal@acme.test",
    },
    partner: {
      company: "Corner Market Co.",
      name: "Cy Park",
      title: "Owner",
      address: "12 Elm St, Brooklyn, NY 11201",
    },
  },
  "partnership-agreement": {
    companyObligations: {
      selected: [
        {
          option: "promoActivities",
          value: "Feature Partner in two customer webinars per year",
        },
        {
          option: "payment",
          value: "$2,000 per quarter for co-marketing",
        },
        { option: "brandElements" },
      ],
    },
    partnerObligations: {
      selected: [
        {
          option: "referrals",
          value:
            "A U.S. retailer with 10 or more stores that has not used Acme",
        },
        { option: "brandElements" },
      ],
    },
    territory: { option: "areas", value: "The United States and Canada" },
    paymentProcess: {
      selected: [{ option: "partnerBills", value: "billing@acme.test" }],
    },
    paymentSchedule: {
      option: "schedule",
      value: "30 days from receipt of invoice",
    },
    endDate: {
      option: "afterEffective",
      value: { amount: 1, unit: "years" },
    },
    effectiveDate: { option: "custom", value: "2026-11-01" },
    governingLaw: {
      region: "Ontario, Canada",
      courtLocation: "Toronto, Ontario",
    },
    companyCoveredClaim: { option: "standard" },
    partnerCoveredClaim: {
      option: "custom",
      value:
        "Partner's breach of its representations and warranties in Section 7.",
    },
    generalCap: {
      option: "greater",
      value: { amount: { amount: 25_000, currency: "USD" }, multiple: 2 },
    },
    increasedClaims: {
      selected: [{ option: "confidentiality" }, { option: "indemnity" }],
    },
    increasedCap: {
      option: "fixed",
      value: { amount: 250_000, currency: "USD" },
    },
    unlimitedClaims: {
      selected: [{ option: "misconduct" }],
      other: "A party's infringement of the other party's trademarks.",
    },
    additionalWarranties: {
      selected: [
        {
          option: "byPartner",
          value: "Partner's referrals come from its own customer lists.",
        },
      ],
    },
    dpa: "Acme's Data Processing Agreement at https://acme.test/dpa",
    brandGuidelines: {
      selected: [
        { option: "company", value: "https://acme.test/brand" },
        { option: "partner", value: "Attached as Exhibit A" },
      ],
    },
    modifications: "Section 3.4 approvals may be given by email.",
    company: {
      company: "Acme Analytics, Inc.",
      name: "Ana Diaz",
      title: "CEO",
      email: "legal@acme.test",
    },
    partner: {
      company: "Maple Retail Group Ltd.",
      name: "Dee Singh",
      title: "Head of Alliances",
      email: "alliances@maple.test",
      address: "200 Bay St, Toronto, ON M5J 2J1, Canada",
    },
  },
  dpa: {
    agreement:
      "Cloud Service Agreement between Northwind Health Analytics, Inc. and Lumen Clinics GmbH, dated October 1, 2026",
    approvedSubprocessors: { option: "listed" },
    subprocessors: [
      {
        name: "Stratus Cloud Hosting, Inc.",
        country: "United States, Germany",
        task: "Hosting and storage of the Service",
      },
      {
        name: "Parcel Mail Ltd.",
        country: "Ireland",
        task: "Sending account emails",
      },
    ],
    providerSecurityContact: "security@northwind.test",
    securityPolicy: {
      selected: [
        { option: "online", value: "https://northwind.test/security" },
        {
          option: "certifications",
          value: {
            selected: [{ option: "iso27001" }, { option: "soc2Type2" }],
            other: "Annual third-party penetration test",
          },
        },
      ],
    },
    coveredClaim: {
      option: "otherAgreement",
      value:
        "(1) Provider’s breach or alleged breach of the DPA, or (2) Provider’s gross negligence or willful misconduct, in each case, that results in a Security Incident.",
    },
    liabilityCap: {
      option: "otherAgreement",
      value: { amount: { amount: 1000000, currency: "USD" }, multiple: 3 },
    },
    governingLaw: { option: "none" },
    serviceProviderRelationship: { option: "serviceProvider" },
    governingMemberState: { option: "IE" },
    ukTransfers: { option: "englandWales" },
    customer: {
      company: "Lumen Clinics GmbH",
      name: "Lena Vogel",
      title: "Data Protection Officer",
      email: "privacy@lumen.test",
      address: "Torstraße 12, 10119 Berlin, Germany",
    },
    customerRole: { option: "controller" },
    provider: {
      company: "Northwind Health Analytics, Inc.",
      name: "Omar Haddad",
      title: "General Counsel",
      email: "legal@northwind.test",
      address: "500 Howard St, San Francisco, CA 94105",
    },
    service: "Northwind Patient Insights",
    dataSubjectCategories: {
      selected: [{ option: "endUsers" }, { option: "employees" }],
      other: "Patients of Customer’s clinics",
    },
    personalDataCategories: {
      selected: [
        { option: "name" },
        { option: "contact" },
        { option: "activity" },
      ],
      other: "Appointment history",
    },
    specialCategoryData: { option: "yes" },
    specialCategorySafeguards: {
      selected: [{ option: "securityPolicy" }],
      other:
        "Health data is encrypted with per-customer keys and only named support staff can access it.",
    },
    transferFrequency: { selected: [{ option: "continuous" }] },
    processingNature: {
      selected: [
        { option: "receiving" },
        { option: "holding" },
        { option: "using" },
        { option: "protecting" },
        { option: "erasing" },
      ],
    },
    processingDuration: { option: "standard" },
    supervisoryAuthority: { option: "dataExporter" },
    securityMeasures: {
      selected: [{ option: "securityPolicy" }, { option: "described" }],
    },
    securityMeasureDetails: {
      inTransit: "All traffic uses TLS 1.2 or newer.",
      atRest: "Databases and backups use AES-256 encryption.",
      restoration: "Daily backups are kept for 30 days and restored in tests.",
    },
  },
} as const

const byId: Readonly<Record<string, unknown>> = examples

/** Every registered document with its example, for loops over all of them. */
export const registered: {
  id: string
  definition: DocumentDefinition
  example: unknown
}[] = Object.entries(definitions).map(([id, definition]) => ({
  id,
  definition,
  example: byId[id],
}))
