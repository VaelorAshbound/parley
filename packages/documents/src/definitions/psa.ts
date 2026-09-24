import catalog from "../../generated/catalog.ts"
import template from "../../generated/psa.ts"
import { defineDocument, type SignatureRow } from "../define.ts"
import { field } from "../fields.ts"
import { bold, link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official PSA cover page: one SOW, then the Key
// Terms, signed once (work/PAR-1/cover-pages/psa.md has every judgment call).

const amount = () =>
  field.money({ label: "Amount", help: "The fixed amount of the cap." })
const multiple = (min: number) =>
  field.number({
    label: "Multiple",
    help: "How many times 12 months of fees, like 1 or 1.5.",
    min,
    minExclusive: true,
    max: 100,
    decimals: 2,
  })
const fees12Months =
  "x the fees paid or payable by Customer to Provider in the 12 month period immediately before the claim."

/** General (more than 0x) or Increased (more than 1x) Cap Amount. */
const capAmount = (label: string, help: string, min: number) => ({
  label,
  help,
  options: {
    multiple: { label: `{value}${fees12Months}`, with: multiple(min) },
    fixed: { label: "{value}", with: amount() },
    greater: {
      label: `The greater of {amount} or {multiple}${fees12Months}`,
      blanks: { amount: amount(), multiple: multiple(min) },
    },
  },
})

// Increased and Unlimited Claims share the official options and keys, so a
// rule can stop one claim from sitting in both lists. This is the Increased
// Claims order; Unlimited Claims lists them in its own official order.
const claims = {
  privacySecurity: { label: "Breach of Section 3 (Privacy & Security)" },
  confidentiality: {
    label:
      "Breach of Section 11 (Confidentiality) (however, excluding any breach of Section 3 (Privacy & Security))",
  },
  indemnification: {
    label:
      "An Indemnifying Party’s indemnification obligations for its Covered Claims",
  },
  privacySecurityGross: {
    label:
      "Breach of Section 3 (Privacy & Security) resulting from gross negligence or willful misconduct",
  },
  confidentialityGross: {
    label:
      "Breach of Section 11 (Confidentiality) resulting from gross negligence or willful misconduct (however, excluding any breach of Section 3 (Privacy & Security))",
  },
  grossNegligence: {
    label:
      "Claims resulting from a party’s gross negligence or willful misconduct",
  },
}

const coveredClaims = (label: string, help: string, standard: string) =>
  field.choice({
    label,
    help,
    options: {
      standard: {
        label: `Any action, suit, proceeding, or claim that ${standard}`,
      },
      custom: {
        label: "Any action, suit, proceeding, or claim that {value}",
        with: field.longText({
          label: "Covered claims",
          help: "The claims covered, in your own words.",
        }),
      },
      none: { label: "None." },
    },
    default: { option: "standard" },
  })

const limit = (policy: string) => ({
  label: `${policy} with a minimum limit for each occurrence of at least {occurrence} and at least {aggregate} in the aggregate`,
  blanks: {
    occurrence: field.money({
      label: "Each occurrence",
      help: "The least the policy pays for one claim.",
    }),
    aggregate: field.money({
      label: "Aggregate",
      help: "The least the policy pays for all claims together.",
    }),
  },
})
const insurance = (party: "Provider" | "Customer") => {
  const insured = `The following of ${party}’s policies will cover ${party === "Provider" ? "Customer" : "Provider"} as additional insured:`
  return field.choices({
    label: `Insurance minimums for ${party}`,
    help: `Insurance ${party} must carry, and its minimum limits.`,
    optional: true,
    options: {
      generalLiability: limit("Commercial general liability"),
      workersCompensation: {
        label: "Workers’ compensation insurance as required by Applicable Law",
      },
      professionalLiability: limit(
        "Errors and omissions or professional liability"
      ),
      cyberLiability: limit("Cyber liability insurance"),
      automobileLiability: limit("Commercial automobile liability"),
      insuredGeneralLiability: {
        label: `${insured} Commercial general liability`,
      },
      insuredErrorsAndOmissions: { label: `${insured} Errors and omissions` },
      insuredCyberLiability: { label: `${insured} Cyber liability` },
    },
  })
}

const signatureRows: SignatureRow[] = [
  { label: "Company", part: "company" },
  { label: "Signature", part: null },
  { label: "Print Name", part: "name" },
  { label: "Title", part: "title" },
  { label: "Notice Address", part: "notice" },
  { label: "Date", part: null },
]

export const psa = defineDocument({
  id: "psa",
  version: 1,
  name: catalog.psa.name,
  template,
  fields: {
    provider: field.party({
      label: "Provider",
      help: "The company doing the work.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company buying the services.",
    }),
    // --- SOW ---
    services: field.longText({
      label: "Services",
      help: "What Provider will do: scope, key people, timeline and milestones.",
    }),
    deliverables: field.choice({
      label: "Deliverables",
      help: "What Provider hands over for Customer to own, if anything.",
      options: {
        listed: {
          label: "The Deliverables are: {value}",
          with: field.longText({
            label: "Deliverables",
            help: "The work Customer will own, like designs, code or reports.",
          }),
        },
        none: { label: "This SOW has no Deliverables." },
      },
    }),
    deliverableTerms: field.choices({
      label: "Drafts and acceptance",
      help: "Whether drafts count as Deliverables, and whether Customer may reject them.",
      optional: true,
      options: {
        drafts: {
          label:
            "In addition to completed projects, Deliverables include in-progress but not complete drafts or components of Deliverables and their associated intellectual property.",
        },
        acceptance: {
          label:
            "Deliverables are subject to the acceptance process in Section 1.4 with the following details:",
        },
      },
    }),
    rejectionPeriod: field.duration({
      label: "Rejection period",
      help: "How long Customer has to reject a submitted Deliverable.",
      optional: true,
      units: ["days", "businessDays", "weeks", "months"],
    }),
    resubmissionPeriod: field.duration({
      label: "Resubmission period",
      help: "How long Provider has to fix and resubmit a rejected Deliverable.",
      optional: true,
      units: ["days", "businessDays", "weeks", "months"],
    }),
    // Required even with no Deliverables: left empty, Customer would never
    // own the Deliverables, and the engine can't require it only sometimes.
    timeOfAssignment: field.choice({
      label: "Time of assignment",
      help: "When Customer becomes the owner of the Deliverables.",
      options: {
        asCreated: { label: "Customer owns Deliverables as they are created." },
        uponPayment: {
          label: "Customer owns Deliverables upon payment of associated Fees.",
        },
      },
    }),
    thirdPartyMaterials: field.choice({
      label: "Third-party materials",
      help: "Whether others' materials go into the Deliverables, and who gets them.",
      options: {
        none: {
          label:
            "No Third-Party Materials will be incorporated into the Deliverables.",
        },
        incorporated: {
          label:
            "Third-Party Materials will be incorporated into the Deliverables.",
        },
        providerProcures: {
          label:
            "Third-Party Materials will be incorporated into the Deliverables. Provider will procure Third-Party Materials.",
        },
        customerProcures: {
          label:
            "Third-Party Materials will be incorporated into the Deliverables. Customer will procure Third-Party Materials.",
        },
        bothProcure: {
          label:
            "Third-Party Materials will be incorporated into the Deliverables. Provider will procure Third-Party Materials. Customer will procure Third-Party Materials.",
        },
      },
    }),
    fees: field.longText({
      label: "Fees",
      help: "What Customer pays: hourly, per project or per milestone. Currency if not USD.",
    }),
    travelExpenses: field.longText({
      label: "Travel and expenses",
      help: "How travel and expenses are paid, if Customer pays them.",
      optional: true,
    }),
    paymentPeriod: field.choice({
      label: "Payment period",
      help: "How long Customer has to pay each invoice.",
      allowOther: true,
      options: {
        receipt: {
          label: "{value} from Customer’s receipt of invoice",
          with: field.duration({
            label: "Days to pay",
            help: "Days Customer has to pay an invoice.",
            units: ["days"],
          }),
        },
        invoiceDate: {
          label: "{value} from the invoice date",
          with: field.duration({
            label: "Days to pay",
            help: "Days Customer has to pay an invoice.",
            units: ["days"],
          }),
        },
      },
    }),
    invoicePeriod: field.choice({
      label: "Invoice period",
      help: "How often Provider sends invoices.",
      allowOther: true,
      options: {
        monthly: { label: "Monthly" },
        quarterly: { label: "Quarterly" },
        uponAcceptance: { label: "Upon acceptance" },
        afterMilestone: { label: "After each milestone" },
      },
    }),
    sowDate: field.choice({
      label: "SOW date",
      help: "The date this SOW begins.",
      options: {
        lastSignature: { label: "Date of last signature on this Cover Page" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "SOW date",
            help: "The day the SOW starts.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    sowTerm: field.choice({
      label: "SOW term",
      help: "How long this SOW lasts.",
      options: {
        fixed: {
          label:
            "The SOW Term begins on the SOW Date and ends {value} after the SOW Date.",
          with: field.duration({
            label: "SOW length",
            help: "How long after the SOW Date the SOW ends.",
            units: ["days", "weeks", "months", "years"],
          }),
        },
        endDate: {
          label: "The SOW Term begins on the SOW Date and ends on {value}.",
          with: field.date({
            label: "SOW end date",
            help: "The day the SOW ends.",
          }),
        },
      },
      default: { option: "fixed" },
    }),
    customerObligations: field.longText({
      label: "Customer obligations",
      help: "What Customer must do, like name a contact or give system access.",
      optional: true,
    }),
    sowChanges: field.longText({
      label: "SOW changes to Standard Terms",
      help: "Changes to the Standard Terms for this SOW only.",
      optional: true,
    }),
    // --- Key Terms ---
    effectiveDate: field.choice({
      label: "Effective date",
      help: "The date the Agreement starts.",
      options: {
        lastSignature: { label: "Date of last signature on this Cover Page" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Effective date",
            help: "The day the Agreement starts.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    // The terms say "the Governing Law", not "the State of", and the courts
    // may sit anywhere.
    governingLaw: field.jurisdiction({
      label: "Governing law & chosen courts",
      help: "Which laws govern the Agreement, and where disputes are filed.",
      courts: "anywhere",
    }),
    providerCoveredClaims: coveredClaims(
      "Provider covered claims",
      "Claims by others that Provider must defend Customer against.",
      "(a) the Deliverables (excluding any Customer Materials and Third-Party Materials procured by Customer), when used by Customer according to the terms of the SOW and the Agreement, violate, misappropriate, or otherwise infringe upon anyone else’s intellectual property or other proprietary rights; (b) Provider’s employees or Subcontractors are deemed to be Customer’s employees because of Provider’s actions or omissions; or (c) arises out of Provider’s gross negligence, fraud, or willful misconduct."
    ),
    customerCoveredClaims: coveredClaims(
      "Customer covered claims",
      "Claims by others that Customer must defend Provider against.",
      "(a) Customer Materials or Third-Party Materials procured by Customer, when used by Provider according to the terms of the SOW and the Agreement, violate, misappropriate, or otherwise infringe upon anyone else’s intellectual property or other proprietary rights; or (b) arises out of Customer’s gross negligence, fraud, or willful misconduct."
    ),
    // Required: an empty General Cap Amount means unlimited liability.
    generalCapAmount: field.choice({
      ...capAmount(
        "General cap amount",
        "The most either party can owe for most claims.",
        0
      ),
      default: { option: "multiple" },
    }),
    increasedClaims: field.choices({
      label: "Increased claims",
      help: "Claims with a higher cap than the General Cap Amount.",
      optional: true,
      allowOther: true,
      options: claims,
    }),
    increasedCapAmount: field.choice({
      ...capAmount(
        "Increased cap amount",
        "The higher cap for Increased Claims, often called a supercap.",
        1
      ),
      optional: true,
    }),
    unlimitedClaims: field.choices({
      label: "Unlimited claims",
      help: "Claims with no liability cap at all.",
      optional: true,
      allowOther: true,
      options: {
        privacySecurityGross: claims.privacySecurityGross,
        confidentialityGross: claims.confidentialityGross,
        indemnification: claims.indemnification,
        privacySecurity: claims.privacySecurity,
        confidentiality: claims.confidentiality,
        grossNegligence: claims.grossNegligence,
      },
    }),
    providerWarranties: field.longText({
      label: "Additional warranties by Provider",
      help: "Extra promises Provider makes, beyond the Standard Terms.",
      optional: true,
    }),
    customerWarranties: field.longText({
      label: "Additional warranties by Customer",
      help: "Extra promises Customer makes, beyond the Standard Terms.",
      optional: true,
    }),
    providerInsurance: insurance("Provider"),
    customerInsurance: insurance("Customer"),
    dpa: field.longText({
      label: "DPA",
      help: "Where to find the data processing agreement, if one is needed.",
      optional: true,
    }),
    customerPolicies: field.longText({
      label: "Customer policies",
      help: "Customer rules Provider must follow, or where to find them.",
      optional: true,
    }),
    securityPolicy: field.text({
      label: "Security policy",
      help: "Where to find Provider's security policy, like a link.",
      optional: true,
    }),
    securityCertifications: field.choices({
      label: "Security certifications",
      help: "Reports or certifications Provider keeps up to date every year.",
      optional: true,
      allowOther: true,
      options: {
        iso27001: { label: "ISO 27001" },
        soc2Type1: { label: "SOC 2 Type I" },
        soc2Type2: { label: "SOC 2 Type II" },
        hitrust: { label: "HITRUST" },
        penetrationTesting: { label: "Penetration testing" },
        pciLevel1: { label: "PCI Level 1" },
        pciLevel2: { label: "PCI Level 2" },
        fedramp: { label: "FedRAMP Authorized" },
      },
    }),
    publicityRights: field.choices({
      label: "Publicity rights",
      help: "Whether Provider may name Customer as a customer.",
      optional: true,
      options: {
        public: {
          label:
            "Provider may identify Customer and use Customer’s logo and trademarks on Provider’s website and in marketing materials to identify Customer as a customer. Customer hereby grants Provider a non-exclusive, royalty-free license to do so in connection with any marketing, promotion, or advertising of Provider during the length of the Agreement.",
        },
        nonPublic: {
          label:
            "Provider may identify Customer as a customer in non-public settings, including with potential investors and advisors.",
        },
      },
    }),
    otherChanges: field.longText({
      label: "Other changes to Standard Terms",
      help: "Changes to the Standard Terms for the Agreement and all SOWs.",
      optional: true,
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    Deliverables: "deliverables",
    Deliverable: "deliverables",
    "Rejection Period": "rejectionPeriod",
    "Resubmission Period": "resubmissionPeriod",
    "Time of Assignment": "timeOfAssignment",
    Fees: "fees",
    "Payment Period": "paymentPeriod",
    "SOW Term": "sowTerm",
    "Customer Obligations": "customerObligations",
    "Effective Date": "effectiveDate",
    "Governing Law": "governingLaw",
    "Chosen Courts": "governingLaw.courtLocation",
    "Provider Covered Claims": "providerCoveredClaims",
    "Provider Covered Claim": "providerCoveredClaims",
    "Customer Covered Claims": "customerCoveredClaims",
    "Customer Covered Claim": "customerCoveredClaims",
    "General Cap Amount": "generalCapAmount",
    "Increased Claims": "increasedClaims",
    "Increased Cap Amount": "increasedCapAmount",
    "Unlimited Claims": "unlimitedClaims",
    "Additional Warranties": ["providerWarranties", "customerWarranties"],
    "Insurance Minimums": ["providerInsurance", "customerInsurance"],
    DPA: "dpa",
    "Customer Policies": "customerPolicies",
    "Security Policy": ["securityPolicy", "securityCertifications"],
  },
  coverPage: {
    source: "parley",
    title: "Professional Services Agreement",
    subtitle: "USING THIS AGREEMENT",
    intro: [
      paragraph(
        "This Agreement has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common Paper Professional Services Standard Terms Version 1.1 posted at ",
        link(
          "commonpaper.com/standards/professional-services-agreement/1.1",
          "https://commonpaper.com/standards/professional-services-agreement/1.1"
        ),
        " (“",
        bold("Standard Terms"),
        "”), which is incorporated by reference. If there is any inconsistency between the parts of the Agreement, the Cover Page will control over the Standard Terms. Capitalized and highlighted words have the meanings given on the Cover Page. However, if the Cover Page omits or does not define a highlighted word, the default meaning will be “none” or “not applicable” and the correlating clause, sentence, or section does not apply to this Agreement. All other capitalized words have the meanings given in the Standard Terms. A copy of the Standard Terms is attached for convenience only."
      ),
      paragraph(
        "This SOW (“",
        bold("SOW"),
        "”) incorporates the Agreement with the Key Terms below. If there is any inconsistency between this SOW and the Agreement, this SOW will control."
      ),
    ],
    sections: [
      {
        heading: "SOW",
        hint: "The key business terms of this SOW are as follows:",
        part: true,
      },
      { heading: "Services", field: "services" },
      { heading: "Deliverables", field: "deliverables" },
      {
        heading: "Drafts and Acceptance",
        field: "deliverableTerms",
        when: { field: "deliverables", option: "listed" },
      },
      {
        heading: "Rejection Period",
        field: "rejectionPeriod",
        template: "{value} from Deliverable submission",
        when: { field: "deliverableTerms", option: "acceptance" },
      },
      {
        heading: "Resubmission Period",
        field: "resubmissionPeriod",
        template: "{value} from notice of rejection",
        when: { field: "deliverableTerms", option: "acceptance" },
      },
      { heading: "Time of Assignment", field: "timeOfAssignment" },
      { heading: "Third-Party Materials", field: "thirdPartyMaterials" },
      {
        heading: "Fees",
        lines: [
          { field: "fees" },
          { label: "Travel and expenses", field: "travelExpenses" },
        ],
      },
      {
        heading: "Payment Period",
        hint: "Time frame for Customer to pay invoices",
        field: "paymentPeriod",
      },
      {
        heading: "Invoice Period",
        hint: "How frequently Provider sends invoices",
        field: "invoicePeriod",
      },
      {
        heading: "SOW Date",
        hint: "The date this SOW begins",
        field: "sowDate",
      },
      {
        heading: "SOW Term",
        hint: "How long this SOW lasts",
        field: "sowTerm",
      },
      { heading: "Customer Obligations", field: "customerObligations" },
      {
        heading: "Other Changes to Standard Terms",
        hint: "Changes that apply for this SOW only",
        field: "sowChanges",
      },
      {
        heading: "Key Terms",
        hint: "The key legal terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Effective Date",
        hint: "The date the Agreement starts",
        field: "effectiveDate",
      },
      {
        heading: "Governing Law",
        field: "governingLaw",
        template: "The laws of {value}",
      },
      {
        heading: "Chosen Courts",
        hint: "Jurisdiction or where disputes are filed",
        field: "governingLaw.courtLocation",
        template: "The {value} (whether state, federal, or otherwise)",
      },
      {
        heading: "Covered Claims",
        hint: "Claims covered by indemnity obligations",
        lines: [
          { label: "Provider Covered Claims", field: "providerCoveredClaims" },
          { label: "Customer Covered Claims", field: "customerCoveredClaims" },
        ],
      },
      {
        heading: "General Cap Amount",
        hint: "Limitation of liability amount for most claims",
        field: "generalCapAmount",
      },
      {
        heading: "Increased Claims",
        hint: "Specific claims covered by the Increased Cap Amount",
        field: "increasedClaims",
      },
      {
        heading: "Increased Cap Amount",
        hint: "Higher limitation of liability amount for Increased Claims, often called a supercap",
        field: "increasedCapAmount",
      },
      {
        heading: "Unlimited Claims",
        hint: "Claims excluded from any liability cap",
        field: "unlimitedClaims",
      },
      {
        heading: "Additional Warranties",
        lines: [
          { label: "By Provider", field: "providerWarranties" },
          { label: "By Customer", field: "customerWarranties" },
        ],
      },
      {
        heading: "Insurance Minimums for Provider",
        hint: "Requirements for Provider’s policies",
        field: "providerInsurance",
      },
      {
        heading: "Insurance Minimums for Customer",
        hint: "Requirements for Customer’s policies",
        field: "customerInsurance",
      },
      {
        heading: "DPA",
        hint: "Data Processing Agreement",
        field: "dpa",
      },
      { heading: "Customer Policies", field: "customerPolicies" },
      {
        heading: "Security Policy",
        field: "securityPolicy",
        template: "Security Policy available at {value}",
      },
      {
        heading: "Security Certifications",
        hint: "Provider will maintain annually updated reports or annual certifications of compliance with the following:",
        field: "securityCertifications",
      },
      {
        heading: "Publicity Rights",
        hint: "Modifying Section 12.7 of the Standard Terms",
        field: "publicityRights",
      },
      {
        heading: "Other Changes to Standard Terms",
        hint: "Changes that apply to the Agreement and all SOWs",
        field: "otherChanges",
      },
    ],
    closing: [
      paragraph(
        bold("Provider"),
        " and ",
        bold("Customer"),
        " have not changed the Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this Agreement as of the ",
        bold("Effective Date"),
        " and into this SOW as of the ",
        bold("SOW Date"),
        "."
      ),
    ],
    signatures: ["provider", "customer"],
    signatureRows,
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link(
          "Professional Services Agreement cover page",
          "https://commonpaper.com/standards/professional-services-agreement/"
        ),
        ", free to use under ",
        link("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
        "."
      ),
      paragraph(
        "Common Paper Professional Services Standard Terms (Version 1.1) free to use under ",
        link("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
        "."
      ),
    ],
  },
  rules: (values, issue) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const provider = company(values.provider?.company)
    if (
      provider !== undefined &&
      provider === company(values.customer?.company)
    )
      issue("customer", "The two parties must be different companies.")

    // Common Paper: "You can select something as an Increased Claim or an
    // Unlimited Claim, but not both."
    const increased = new Set(
      values.increasedClaims?.selected.map((pick) => pick.option)
    )
    if (
      values.unlimitedClaims?.selected.some((pick) =>
        increased.has(pick.option)
      )
    )
      issue(
        "unlimitedClaims",
        "A claim can be an Increased Claim or an Unlimited Claim, not both."
      )
  },
})
