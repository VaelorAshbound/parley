import catalog from "../../generated/catalog.ts"
import template from "../../generated/dpa.ts"
import { defineDocument } from "../define.ts"
import { EU_MEMBER_STATES, field } from "../fields.ts"
import { bold, link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official DPA 1.1 cover page. The cover page carries
// the EU SCC Annexes I–III (Standard Terms 3.2(c)(vii) and 3.3(c)), so it
// holds rows no linked term points to. Notes: work/PAR-1/cover-pages/dpa.md.

const STANDARD_TERMS =
  "https://commonpaper.com/standards/data-processing-agreement/1.1/"
const COVER_PAGE =
  "https://commonpaper.com/standards/data-processing-agreement/1.1/cover-page-docx"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const measure = (label: string, help: string) =>
  field.longText({ label, help, optional: true })

export const dpa = defineDocument({
  id: "dpa",
  version: 1,
  name: catalog.dpa.name,
  template,
  fields: {
    // --- Key Terms ---
    agreement: field.text({
      label: "Agreement",
      help: "The main contract this DPA adds to: its name, parties and date.",
    }),
    approvedSubprocessors: field.choice({
      label: "Approved subprocessors",
      help: "Vendors Provider may use to process Customer's personal data.",
      options: {
        online: {
          label: "List of Subprocessors available at {value}",
          with: field.url({
            label: "Subprocessor list URL",
            help: "The web page that lists Provider's subprocessors.",
          }),
        },
        listed: { label: "The Subprocessors listed below" },
        none: { label: "None" },
      },
      default: { option: "online" },
    }),
    subprocessors: field.list({
      label: "Subprocessors",
      help: "Each subprocessor, where it is, and what it does.",
      optional: true,
      item: {
        name: field.text({
          label: "Subprocessor name",
          help: "The subprocessor's company name.",
        }),
        country: field.text({
          label: "Country of location",
          help: "Every country where it processes the data.",
        }),
        task: field.text({
          label: "Anticipated Processing task",
          help: "What it does with the data, like hosting or email delivery.",
        }),
      },
    }),
    providerSecurityContact: field.text({
      label: "Provider security contact",
      help: "Email or postal address for security questions to Provider.",
    }),
    securityPolicy: field.choices({
      label: "Security policy",
      help: "The security standard Provider follows and is audited against.",
      options: {
        agreement: { label: "As defined in the Agreement." },
        reasonableEfforts: {
          label:
            "Provider will use commercially reasonable efforts to secure the Service from unauthorized access, alteration, or use and other unlawful tampering.",
        },
        online: {
          label: "Security Policy available at {value}",
          with: field.url({
            label: "Security policy URL",
            help: "The web page with Provider's security policy.",
          }),
        },
        certifications: {
          label:
            "Provider will maintain annually updated reports or annual certifications of compliance with the following: {value}",
          with: field.choices({
            label: "Reports or certifications",
            help: "The audits or certifications Provider renews every year.",
            options: {
              iso27001: { label: "ISO 27001" },
              soc2Type1: { label: "SOC 2 Type I" },
              soc2Type2: { label: "SOC 2 Type II" },
              hipaa: { label: "HIPAA" },
              penetrationTesting: { label: "Penetration testing" },
              pciLevel1: { label: "PCI Level 1" },
              pciLevel2: { label: "PCI Level 2" },
              fedramp: { label: "FedRAMP Authorized" },
            },
            allowOther: true,
          }),
        },
      },
      default: { selected: [{ option: "agreement" }] },
    }),

    // --- Changes to the Agreement ---
    // Common Paper deletes these rows when unused; an explicit "None" keeps
    // the answer on the page instead of a blank.
    coveredClaim: field.choice({
      label: "DPA covered claim",
      help: "An extra indemnity from Provider for this DPA, or none.",
      options: {
        none: { label: "None" },
        commonPaperCsa: {
          label:
            "The Agreement includes an additional Provider Covered Claim for any action, proceeding, or claim arising out of or relating to {value}",
          with: field.longText({
            label: "Covered claim",
            help: "What the indemnity covers, like Provider's breach of the DPA.",
          }),
        },
        otherAgreement: {
          label:
            "Without limiting the indemnity obligations in the Agreement, if any, Provider will indemnify, defend, and hold harmless Customer from and against any action, proceeding, or claim made by someone other than Customer, Customer’s Affiliates, or Users, and all out-of-pocket damages, awards, settlements, costs, and expenses, including reasonable attorneys’ fees and other legal expenses, that arise from {value}",
          with: field.longText({
            label: "Covered claim",
            help: "What the indemnity covers, like Provider's breach of the DPA.",
          }),
        },
      },
    }),
    liabilityCap: field.choice({
      label: "DPA liability cap",
      help: "A separate liability cap for DPA covered claims, or none.",
      options: {
        none: { label: "None" },
        commonPaperCsa: {
          label:
            "The Agreement includes an additional Increased Claim for DPA Covered Claims, with a separate Increased Cap Amount of the greater of {amount} or {multiple} times the fees paid or payable by Customer to Provider in the 12 month period immediately before the claim.",
          blanks: {
            amount: field.money({
              label: "Cap amount",
              help: "The fixed part of the cap.",
            }),
            multiple: field.number({
              label: "Fee multiple",
              help: "How many times the yearly fees. More than 1.",
              min: 1,
              minExclusive: true,
              decimals: 2,
            }),
          },
        },
        otherAgreement: {
          label:
            "The following is added to the end of Section 8.1 of the DPA Standard Terms: However, Provider’s total cumulative liability arising out of or related to DPA Covered Claims will not be more than the greater of {amount} or {multiple} times the fees paid or payable by Customer to Provider in the 12 month period immediately before the claim.",
          blanks: {
            amount: field.money({
              label: "Cap amount",
              help: "The fixed part of the cap.",
            }),
            multiple: field.number({
              label: "Fee multiple",
              help: "How many times the yearly fees. More than 1.",
              min: 1,
              minExclusive: true,
              decimals: 2,
            }),
          },
        },
      },
    }),
    // The official row names one place, "a state, province, or country", and
    // its courts; `field.jurisdiction` would add a court-city blank it lacks.
    governingLaw: field.choice({
      label: "Governing law and chosen courts",
      help: "A separate governing law and courts for this DPA, or none.",
      options: {
        none: { label: "None" },
        governingState: {
          label:
            "Notwithstanding the governing law or similar clauses of the Agreement, all interpretations and disputes about this DPA will be governed by the laws of the Governing State without regard to its conflict of laws provisions. In addition, and notwithstanding the forum selection, jurisdiction, or similar clauses of the Agreement, the parties agree to bring any legal suit, action, or proceeding about this DPA in, and each party irrevocably submits to the exclusive jurisdiction of, the courts of the Governing State. Governing State means: {value}",
          with: field.text({
            label: "Governing State",
            help: "A state, province, or country.",
          }),
        },
      },
    }),
    serviceProviderRelationship: field.choice({
      label: "Service provider relationship",
      help: "Whether Provider is a CCPA service provider that never sells data.",
      options: {
        none: { label: "None" },
        serviceProvider: {
          label:
            "To the extent California Consumer Privacy Act, Cal. Civ. Code § 1798.100 et seq (“CCPA”) applies, the parties acknowledge and agree that Provider is a service provider and is receiving Personal Data from Customer to provide the Service as agreed in the Agreement and detailed below (see Nature and Purpose of Processing), which constitutes a limited and specified business purpose. Provider will not sell or share any Personal Data provided by Customer under the Agreement. In addition, Provider will not retain, use, or disclose any Personal Data provided by Customer under the Agreement except as necessary for providing the Service for Customer, as stated in the Agreement, or as permitted by Applicable Data Protection Laws. Provider certifies that it understands the restrictions of this paragraph and will comply with all Applicable Data Protection Laws. Provider will notify Customer if it can no longer meet its obligations under the CCPA.",
        },
      },
    }),

    // --- Restricted Transfers ---
    // A choice, not `field.select`: a select's string options don't fit
    // `AnyField`, so no definition can hold one yet (engine gap, see notes).
    governingMemberState: field.choice({
      label: "Governing member state",
      help: "The EU country whose law and courts govern the EU transfer clauses.",
      options: Object.fromEntries(
        Object.entries(EU_MEMBER_STATES).map(([code, name]) => [
          code,
          { label: name },
        ])
      ),
    }),
    ukTransfers: field.choice({
      label: "UK transfers",
      help: "The UK law and courts for the UK transfer addendum.",
      optional: true,
      options: {
        englandWales: { label: "Laws of England and Wales" },
        scotland: { label: "Laws of Scotland" },
        northernIreland: { label: "Laws of Northern Ireland" },
      },
    }),

    // --- Annex I(A) List of Parties ---
    customer: field.party({
      label: "Customer",
      help: "The data exporter: the company whose personal data Provider processes.",
    }),
    customerRole: field.choice({
      label: "Customer's role",
      help: "Controller if Customer owns the data; Processor if it handles it for another.",
      options: {
        controller: { label: "Controller" },
        processor: { label: "Processor" },
      },
    }),
    provider: field.party({
      label: "Provider",
      help: "The data importer: the company giving the Service and processing data.",
    }),

    // --- Annex I(B) Description of Transfer and Processing Activities ---
    service: field.text({
      label: "Service",
      help: "The name of the product or service Provider gives Customer.",
    }),
    dataSubjectCategories: field.choices({
      label: "Categories of data subjects",
      help: "Whose personal data Provider processes.",
      options: {
        endUsers: { label: "Customer’s end users or customers" },
        employees: { label: "Customer’s employees" },
      },
      allowOther: true,
    }),
    personalDataCategories: field.choices({
      label: "Categories of personal data",
      help: "What kinds of personal data Provider processes.",
      options: {
        name: { label: "Name" },
        contact: {
          label: "Contact information such as email, phone number, or address",
        },
        employment: {
          label: "Employment information such as employee ID or compensation",
        },
        financial: {
          label: "Financial information such as bank account numbers",
        },
        professional: {
          label: "Professional or biographic information such as resume or CV",
        },
        transactional: {
          label:
            "Transactional information such as account information or purchases",
        },
        activity: {
          label:
            "User activity and analysis such as device information or IP address",
        },
        location: { label: "Location information" },
      },
      allowOther: true,
    }),
    specialCategoryData: field.choice({
      label: "Special category data",
      help: "Health, race, religion, biometrics or other extra-sensitive data.",
      options: { yes: { label: "Yes" }, no: { label: "No" } },
    }),
    specialCategorySafeguards: field.choices({
      label: "Special category safeguards",
      help: "Extra protections for sensitive data, like access limits or encryption.",
      // Shown and needed only when special category data is processed.
      optional: true,
      options: { securityPolicy: { label: "See Security Policy" } },
      allowOther: true,
      longOther: true,
    }),
    transferFrequency: field.choices({
      label: "Frequency of transfer",
      help: "How often Customer sends personal data to Provider.",
      options: { continuous: { label: "Continuous" } },
      allowOther: true,
    }),
    processingNature: field.choices({
      label: "Nature of processing",
      help: "What Provider does with the personal data.",
      options: {
        receiving: {
          label:
            "Receiving data, including collection, accessing, retrieval, recording, and data entry",
        },
        holding: {
          label:
            "Holding data, including storage, organization, and structuring",
        },
        using: {
          label:
            "Using data, including analysis, consultation, testing, automated decision making, and profiling",
        },
        updating: {
          label:
            "Updating data, including correcting, adaptation, alteration, alignment, and combination",
        },
        protecting: {
          label:
            "Protecting data, including restricting, encrypting, and security testing",
        },
        sharing: {
          label:
            "Sharing data, including disclosure, dissemination, allowing access, or otherwise making available",
        },
        returning: {
          label: "Returning data to the data exporter or data subject",
        },
        erasing: {
          label: "Erasing data, including destruction and deletion",
        },
      },
      allowOther: true,
    }),
    // Fixed text on the official page ("not intended to be modified"): one
    // option, pre-picked, because a linked term needs a field.
    processingDuration: field.choice({
      label: "Duration of processing",
      help: "How long Provider processes the data. Common Paper's fixed wording.",
      options: {
        standard: {
          label:
            "Provider will process Customer Personal Data as long as required (i) to conduct the Processing activities instructed in Section 2.2(a)-(d) of the Standard Terms; or (ii) by Applicable Laws.",
        },
      },
      default: { option: "standard" },
    }),

    // --- Annex I(C) ---
    // Fixed text too; the engine prints a row only through a field.
    supervisoryAuthority: field.choice({
      label: "Competent supervisory authority",
      help: "The data protection authority for the transfer. Common Paper's fixed wording.",
      options: {
        dataExporter: {
          label:
            "The supervisory authority will be the supervisory authority of the data exporter, as determined in accordance with Clause 13 of the EEA SCCs or the relevant provision of the UK Addendum.",
        },
      },
      default: { option: "dataExporter" },
    }),

    // --- Annex II ---
    securityMeasures: field.choices({
      label: "Security measures",
      help: "How Provider keeps the personal data safe (SCC Annex II).",
      options: {
        securityPolicy: { label: "See Security Policy" },
        described: { label: "The measures described below" },
      },
      default: { selected: [{ option: "securityPolicy" }] },
    }),
    securityMeasureDetails: field.group({
      label: "Described security measures",
      help: "Each security measure Provider uses, described in a short paragraph.",
      optional: true,
      parts: {
        pseudonymization: measure(
          "Pseudonymization and encryption of personal data",
          "How personal data is pseudonymized and encrypted."
        ),
        resilience: measure(
          "Ensuring ongoing confidentiality, integrity, availability, and resilience of processing systems and services",
          "How systems stay confidential, intact, available and resilient."
        ),
        restoration: measure(
          "Ability to restore the availability of and access to Customer Personal Data in a timely manner following a physical or technical incident",
          "How data is restored after an outage, like backups."
        ),
        testing: measure(
          "Regular testing, assessment, and evaluation of the effectiveness of technical and organizational measures used to secure Processing",
          "How often and how the security measures are tested."
        ),
        identification: measure(
          "User identification and authorization process and protection",
          "How users sign in and get access, like SSO or MFA."
        ),
        inTransit: measure(
          "Protecting Customer Personal Data during transmission (in transit)",
          "How data is protected while it moves, like TLS."
        ),
        atRest: measure(
          "Protecting Customer Personal Data during storage (at rest)",
          "How stored data is protected, like disk encryption."
        ),
        physical: measure(
          "Physical security where Customer Personal Data is processed",
          "How the buildings and data centers are secured."
        ),
        logging: measure(
          "Events logging",
          "What events are logged and how logs are kept."
        ),
        configuration: measure(
          "Systems configuration, including default configuration",
          "How systems are set up and kept secure by default."
        ),
        governance: measure(
          "Internal IT and IT security governance and management",
          "Who runs IT security and how it is managed."
        ),
        certification: measure(
          "Certification or assurance of processes and products",
          "Audits or certifications, like SOC 2 or ISO 27001."
        ),
        minimization: measure(
          "Ensuring data minimization",
          "How Provider collects and keeps only the data it needs."
        ),
        quality: measure(
          "Ensuring data quality",
          "How data is kept accurate and up to date."
        ),
        retention: measure(
          "Ensuring limited data retention",
          "How long data is kept and when it is deleted."
        ),
        accountability: measure(
          "Ensuring accountability",
          "How Provider records and shows its compliance."
        ),
        portability: measure(
          "Allowing data portability and ensuring erasure",
          "How data can be exported and fully erased."
        ),
      },
    }),
  },
  linkedTerms: {
    Customer: "customer.company",
    Provider: "provider.company",
    Agreement: "agreement",
    "Approved Subprocessors": "approvedSubprocessors",
    "Provider Security Contact": "providerSecurityContact",
    "Security Policy": "securityPolicy",
    "Governing Member State": "governingMemberState",
    "Categories of Data Subjects": "dataSubjectCategories",
    "Categories of Personal Data": "personalDataCategories",
    "Special Category Data": "specialCategoryData",
    "Special Category Data Restrictions or Safeguards":
      "specialCategorySafeguards",
    "Frequency of Transfer": "transferFrequency",
    "Nature and Purpose of Processing": "processingNature",
    "Duration of Processing": "processingDuration",
  },
  coverPage: {
    source: "parley",
    title: "Data Processing Agreement",
    subtitle: "USING THIS DPA",
    intro: [
      paragraph(
        "This DPA has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common Paper DPA Standard Terms Version 1.1 posted at ",
        link(STANDARD_TERMS, STANDARD_TERMS),
        " (“",
        bold("DPA Standard Terms"),
        "”), which is incorporated by reference. If there is any inconsistency between the parts of the DPA, the Cover Page will control over the DPA Standard Terms. Capitalized and highlighted words have the meanings given on the Cover Page. However, if the Cover Page omits or does not define a highlighted word, the default meaning will be “none” or “not applicable” and the correlating clause, sentence, or section does not apply to this DPA. All other capitalized words have the meanings given in the DPA Standard Terms or the Agreement."
      ),
    ],
    sections: [
      { heading: "Key Terms", part: true },
      {
        heading: "Agreement",
        field: "agreement",
        template: "This DPA supplements the {value}.",
      },
      { heading: "Approved Subprocessors", field: "approvedSubprocessors" },
      {
        heading: "Subprocessors",
        when: { field: "approvedSubprocessors", option: "listed" },
        field: "subprocessors",
      },
      {
        heading: "Provider Security Contact",
        field: "providerSecurityContact",
      },
      { heading: "Security Policy", field: "securityPolicy" },

      { heading: "Changes to the Agreement", part: true },
      { heading: "DPA Covered Claim", field: "coveredClaim" },
      { heading: "DPA Liability Cap", field: "liabilityCap" },
      { heading: "Governing Law and Chosen Courts", field: "governingLaw" },
      {
        heading: "Service Provider Relationship",
        field: "serviceProviderRelationship",
      },

      { heading: "Restricted Transfers", part: true },
      {
        heading: "Governing Member State",
        lines: [
          { label: "EEA Transfers", field: "governingMemberState" },
          { label: "UK Transfers", field: "ukTransfers" },
        ],
      },

      { heading: "Annex I(A) List of Parties", part: true },
      {
        heading: "Data Exporter",
        hint: "Activities relevant to transfer: See Annex I(B).",
        lines: [
          { label: "Name", field: "customer.company" },
          { label: "Address", field: "customer.address" },
          { label: "Contact person", field: "customer.name" },
          { label: "Position", field: "customer.title" },
          { label: "Contact details", field: "customer.email" },
          { label: "Role", field: "customerRole" },
        ],
      },
      {
        heading: "Data Importer",
        hint: "Role: Processor. Activities relevant to transfer: See Annex I(B).",
        lines: [
          { label: "Name", field: "provider.company" },
          { label: "Address", field: "provider.address" },
          { label: "Contact person", field: "provider.name" },
          { label: "Position", field: "provider.title" },
          { label: "Contact details", field: "provider.email" },
        ],
      },

      {
        heading: "Annex I(B) Description of Transfer and Processing Activities",
        part: true,
      },
      { heading: "Service", field: "service" },
      {
        heading: "Categories of Data Subjects",
        field: "dataSubjectCategories",
      },
      {
        heading: "Categories of Personal Data",
        field: "personalDataCategories",
      },
      {
        heading: "Special Category Data",
        hint: "Is special category data Processed?",
        field: "specialCategoryData",
      },
      {
        heading: "Special Category Data Restrictions or Safeguards",
        when: { field: "specialCategoryData", option: "yes" },
        field: "specialCategorySafeguards",
      },
      { heading: "Frequency of Transfer", field: "transferFrequency" },
      {
        heading: "Nature and Purpose of Processing",
        hint: "Provider will Process Customer Personal Data as instructed in Section 2.3 of the DPA Standard Terms. The nature of processing includes:",
        field: "processingNature",
      },
      { heading: "Duration of Processing", field: "processingDuration" },

      { heading: "Annex I(C)", part: true },
      {
        heading: "Competent Supervisory Authority",
        field: "supervisoryAuthority",
      },

      { heading: "Annex II", part: true },
      {
        heading: "Technical and Organizational Security Measures",
        field: "securityMeasures",
      },
      {
        heading: "Described Security Measures",
        when: { field: "securityMeasures", option: "described" },
        field: "securityMeasureDetails",
      },
    ],
    closing: [
      paragraph(
        "Provider and Customer have not changed the DPA Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this DPA as of the last date of signature below."
      ),
    ],
    signatures: ["provider", "customer"],
    // The official table: Signature, Print Name, Title, Date. Its header names
    // each company, so a Company row keeps that; addresses live in Annex I(A).
    signatureRows: [
      { label: "Signature", part: null },
      { label: "Print Name", part: "name" },
      { label: "Title", part: "title" },
      { label: "Company", part: "company" },
      { label: "Date", part: null },
    ],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link("Data Processing Agreement cover page", COVER_PAGE),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Data Processing Agreement Standard Terms (Version 1.1) free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
    ],
  },
  rules: (values, issue) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const first = company(values.provider?.company)
    if (first !== undefined && first === company(values.customer?.company))
      issue("customer", "The two parties must be different companies.")
  },
})
