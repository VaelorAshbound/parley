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
