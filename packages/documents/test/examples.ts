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
