import catalog from "../../generated/catalog.ts"
import template from "../../generated/software-license-agreement.ts"
import { defineDocument, type SignatureRow } from "../define.ts"
import { field } from "../fields.ts"
import { bold, link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official Software License cover page: the Order
// Form, then the Key Terms, signed once (work/PAR-1/cover-pages/
// software-license-agreement.md has every judgment call).

const amount = () =>
  field.money({ label: "Amount", help: "The fixed amount of the cap." })
const multiple = (min: number) =>
  field.number({
    label: "Multiple",
    help: "How many times 12 months of Fees, like 1 or 1.5.",
    min,
    minExclusive: true,
    max: 100,
    decimals: 2,
  })
const fees12Months =
  "x the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim"

/** General (more than 0x) or Increased (more than 1x) Cap Amount. */
const capAmount = (label: string, help: string, min: number, end: string) => ({
  label,
  help,
  options: {
    multiple: { label: `{value}${fees12Months}${end}`, with: multiple(min) },
    fixed: { label: "{value}", with: amount() },
    greater: {
      label: `The greater of {amount} or {multiple}${fees12Months}${end}`,
      blanks: { amount: amount(), multiple: multiple(min) },
    },
  },
})

// Increased and Unlimited Claims share the official options and keys, so a
// rule can stop one claim from sitting in both lists. This is the Increased
// Claims order; Unlimited Claims lists them in its own official order.
const claims = {
  confidentiality: {
    label:
      "Breach of Section 9 (Confidentiality) (however, excluding any data or security breaches)",
  },
  indemnification: {
    label: "An Indemnifying Party’s indemnification obligation",
  },
  licenseBreach: {
    label:
      "Customer’s breach of Section 1.1 (License) or Section 2.1 (Restrictions on Customer)",
  },
  grossNegligence: {
    label: "A party’s gross negligence or willful misconduct",
  },
  confidentialityGross: {
    label:
      "Breach of Section 9 (Confidentiality) resulting from gross negligence or willful misconduct (however, excluding any data or security breaches)",
  },
}

const coveredClaims = (label: string, help: string, standard: string) => ({
  label,
  help,
  options: {
    standard: { label: standard },
    custom: {
      label: "{value}",
      with: field.longText({
        label: "Covered claims",
        help: "The claims covered, in your own words.",
      }),
    },
    none: { label: "None." },
  },
})

// The official "[ monthly | quarterly | … ]" picks inside a sentence. A
// choice, not a select: a select's options don't fit a blank's type.
const frequency = () =>
  field.choice({
    label: "Billing frequency",
    help: "How often Provider bills Customer.",
    options: {
      monthly: { label: "monthly" },
      quarterly: { label: "quarterly" },
      annually: { label: "annually" },
      oncePerPeriod: { label: "once per Subscription Period" },
    },
  })

const signatureRows: SignatureRow[] = [
  { label: "Company", part: "company" },
  { label: "Signature", part: null },
  { label: "Print Name", part: "name" },
  { label: "Title", part: "title" },
  { label: "Notice Address", part: "notice" },
  { label: "Date", part: null },
]

export const softwareLicenseAgreement = defineDocument({
  id: "software-license-agreement",
  version: 1,
  name: catalog["software-license-agreement"].name,
  template,
  fields: {
    provider: field.party({
      label: "Provider",
      help: "The company licensing the Software.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company installing and using the Software.",
    }),
    // --- Order Form ---
    software: field.longText({
      label: "Software",
      help: "The software product Customer may install and use.",
    }),
    orderDate: field.choice({
      label: "Order date",
      help: "The earliest date Customer may install the Software.",
      options: {
        lastSignature: { label: "Date of last signature on this Order Form" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Order date",
            help: "The first day Customer may install the Software.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    subscriptionPeriod: field.duration({
      label: "Subscription period",
      help: "How long the license lasts before it renews, like 12 months.",
      units: ["days", "weeks", "months", "years"],
    }),
    fees: field.longText({
      label: "Fees",
      help: "What Customer pays for the license and services. Currency if not USD.",
    }),
    feeTerms: field.choices({
      label: "Fee increases and taxes",
      help: "Whether Fees may rise at renewal, and whether they include taxes.",
      optional: true,
      options: {
        increaseUpTo: {
          label:
            "Fees may increase up to {value} per renewal if Provider has given notice of the increase prior to the Non-Renewal Notice Date.",
          with: field.percent({
            label: "Largest increase",
            help: "The most Fees may rise at each renewal.",
          }),
        },
        increaseFixed: {
          label: "Fees will increase {value} per renewal.",
          with: field.percent({
            label: "Increase",
            help: "How much Fees rise at each renewal.",
          }),
        },
        includeTaxes: {
          label:
            "Modifying Section 3.1 of the Standard Terms, Fees are inclusive of taxes.",
        },
      },
    }),
    paymentProcess: field.choice({
      label: "Payment process",
      help: "Pay by invoice, or an automatic charge to the payment method on file.",
      options: {
        invoice: {
          label:
            "Pay by invoice. Provider will invoice Customer {frequency}. Customer will pay each invoice within {days} from {from}.",
          blanks: {
            frequency: frequency(),
            days: field.duration({
              label: "Days to pay",
              help: "Days Customer has to pay an invoice.",
              units: ["days"],
            }),
            from: field.choice({
              label: "Counted from",
              help: "When the days to pay start.",
              options: {
                receipt: { label: "Customer’s receipt of invoice" },
                invoiceDate: { label: "the invoice date" },
              },
            }),
          },
        },
        automatic: {
          label:
            "Automatic payment. Customer authorizes Provider to bill and charge Customer’s payment method on file {frequency} for immediate payment or deduction without further approval.",
          blanks: { frequency: frequency() },
        },
      },
    }),
    autoRenewal: field.choice({
      label: "Auto-renewal",
      help: "Whether the license renews, and how early a party must say no.",
      options: {
        notice: {
          label:
            "Non-Renewal Notice Date: At least {value} before the end of the current Subscription Period",
          with: field.duration({
            label: "Notice before renewal",
            help: "How early before renewal a party must give notice.",
            units: ["days"],
          }),
        },
        noRenewal: {
          label:
            "Modifying Section 4.1 of the Standard Terms, this Order Form does not automatically renew and will expire at the end of the Subscription Period.",
        },
      },
      default: { option: "notice" },
    }),
    permittedUses: field.choice({
      label: "Permitted uses",
      help: "What Customer may use the Software for.",
      options: {
        internal: { label: "Customer’s internal business purposes" },
        withAffiliates: {
          label: "Customer’s and its Affiliates’ internal business purposes.",
        },
      },
      default: { option: "internal" },
    }),
    additionalPermittedUses: field.longText({
      label: "Additional permitted uses",
      help: "Other allowed uses, like shipping the Software inside hardware.",
      optional: true,
    }),
    licenseLimits: field.longText({
      label: "License limits",
      help: "Limits on use, like seats, devices, locations or regions.",
      optional: true,
    }),
    warrantyPeriod: field.choice({
      label: "Warranty period",
      help: "How long Provider promises the Software works as documented.",
      options: {
        fromDelivery: {
          label: "{value} from delivery of the Software",
          with: field.duration({
            label: "Warranty length",
            help: "How long the warranty lasts.",
            units: ["days"],
          }),
        },
        fromUpdates: {
          label:
            "{value} from delivery of the Software and each subsequent Update",
          with: field.duration({
            label: "Warranty length",
            help: "How long the warranty lasts.",
            units: ["days"],
          }),
        },
        fromOrderDate: {
          label: "{value} from the Order Date",
          with: field.duration({
            label: "Warranty length",
            help: "How long the warranty lasts.",
            units: ["days"],
          }),
        },
        none: { label: "None. Sections 5.2–5.4 do not apply." },
      },
      default: { option: "fromDelivery" },
    }),
    deletionProcedure: field.choices({
      label: "Deletion procedure",
      help: "What happens to the Software when the license ends.",
      optional: true,
      allowOther: true,
      longOther: true,
      options: {
        disableKeys: { label: "Provider will disable license keys" },
        uninstall: {
          label:
            "Customer will uninstall, delete, and/or discontinue use of the Software",
        },
        certify: {
          label:
            "Customer will certify to Provider that the Software was uninstalled or deleted according to the terms of this Agreement",
        },
      },
    }),
    complianceVerification: field.choice({
      label: "License compliance verification",
      help: "Whether Provider may audit how Customer uses the Software.",
      optional: true,
      options: {
        standard: {
          label:
            "Provider may inspect and audit Customer’s use of the Software under this Agreement during the Subscription Period, and Customer agrees to cooperate or otherwise make available the information that may be reasonably requested by Provider in order to ensure compliance with this Agreement and any usage restrictions. Provider must give at least 7 days advance notice of an audit. If the audit determines that Customer’s use of the Software exceeded the usage permitted by the Agreement, Customer will pay to Provider all amounts due for such excess use of the Software according to the Payment Process.",
        },
        custom: {
          label: "{value}",
          with: field.longText({
            label: "Audit terms",
            help: "How Provider may check Customer's use, in your own words.",
          }),
        },
      },
    }),
    services: field.longText({
      label: "Services",
      help: "Support or maintenance Provider gives with the Software.",
      optional: true,
    }),
    orderFormChanges: field.longText({
      label: "Order Form changes to Standard Terms",
      help: "Changes to the Standard Terms for this Order Form only.",
      optional: true,
    }),
    // --- Key Terms ---
    effectiveDate: field.choice({
      label: "Effective date",
      help: "The date the Framework Terms start.",
      options: {
        lastSignature: { label: "Date of last Cover Page signature" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Effective date",
            help: "The day the Framework Terms start.",
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
    providerCoveredClaims: field.choice({
      ...coveredClaims(
        "Provider covered claims",
        "Claims by others that Provider must defend Customer against.",
        "Any action, proceeding, or claim that the Software, when used by Customer according to the terms of the Agreement, violates, misappropriates, or otherwise infringes upon anyone else’s intellectual property or other proprietary rights."
      ),
      default: { option: "standard" },
    }),
    // Not pre-marked on the official page, so no default (the Help Center
    // says it is on by default; see the notes).
    customerCoveredClaims: field.choice(
      coveredClaims(
        "Customer covered claims",
        "Claims by others that Customer must defend Provider against.",
        "Any action, proceeding, or claim arising from or related to Customer’s or Users’ breach or violation of Section 1.1 (License) or Section 2.1 (Restrictions on Customer)."
      )
    ),
    // Required: an empty General Cap Amount means unlimited liability.
    generalCapAmount: field.choice({
      ...capAmount(
        "General cap amount",
        "The most either party can owe for most claims.",
        0,
        ""
      ),
      default: { option: "multiple" },
    }),
    increasedClaims: field.choices({
      label: "Increased claims",
      help: "Claims with a higher cap than the General Cap Amount.",
      optional: true,
      allowOther: true,
      options: claims,
      default: { selected: [{ option: "confidentiality" }] },
    }),
    increasedCapAmount: field.choice({
      ...capAmount(
        "Increased cap amount",
        "The higher cap for Increased Claims, often called a supercap.",
        1,
        "."
      ),
      optional: true,
      default: { option: "multiple" },
    }),
    unlimitedClaims: field.choices({
      label: "Unlimited claims",
      help: "Claims with no liability cap at all.",
      optional: true,
      allowOther: true,
      options: {
        indemnification: claims.indemnification,
        confidentialityGross: claims.confidentialityGross,
        grossNegligence: claims.grossNegligence,
        confidentiality: claims.confidentiality,
        licenseBreach: claims.licenseBreach,
      },
      default: { selected: [{ option: "indemnification" }] },
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
    dpa: field.longText({
      label: "DPA",
      help: "Where to find the data processing agreement, if one is needed.",
      optional: true,
    }),
    otherChanges: field.longText({
      label: "Other changes to Standard Terms",
      help: "Changes to the Standard Terms for the Framework Terms.",
      optional: true,
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    "Order Date": "orderDate",
    "Subscription Period": "subscriptionPeriod",
    "Subscription Periods": "subscriptionPeriod",
    "Payment Process": "paymentProcess",
    "Non-Renewal Notice Date": "autoRenewal",
    "Permitted Uses": ["permittedUses", "additionalPermittedUses"],
    "License Limits": "licenseLimits",
    "Warranty Period": "warrantyPeriod",
    "Deletion Procedure": "deletionProcedure",
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
  },
  coverPage: {
    source: "parley",
    title: "Software License Agreement",
    subtitle: "USING THE FRAMEWORK TERMS",
    intro: [
      paragraph(
        "The Framework Terms have 2 parts: (1) the Key Terms below (including any attached or referenced policies and documents) and (2) the Common Paper Software License Standard Terms Version 1.1 posted at ",
        link(
          "https://commonpaper.com/standards/software-license-agreement/1.1",
          "https://commonpaper.com/standards/software-license-agreement/1.1"
        ),
        " which are incorporated by reference. If there is any inconsistency between the parts of the Framework Terms, the Key Terms will control over the Standard Terms. Capitalized words have the meanings or descriptions given in the Cover Page or Standard Terms. A copy of the Standard Terms is attached for convenience only."
      ),
      paragraph(
        "This Order Form incorporates and is governed by the Framework Terms included below. If there is any inconsistency between this Order Form and the Framework Terms, this Order Form will control for this Agreement."
      ),
    ],
    sections: [
      {
        heading: "Order Form",
        hint: "The key business terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Software",
        field: "software",
        template: "The Software available under this Order Form is {value}.",
      },
      {
        heading: "Order Date",
        hint: "The earliest date Customer may install Software",
        field: "orderDate",
      },
      { heading: "Subscription Period", field: "subscriptionPeriod" },
      { heading: "Fees", field: "fees" },
      { heading: "Fee Increases and Taxes", field: "feeTerms" },
      { heading: "Payment Process", field: "paymentProcess" },
      { heading: "Auto-renewal", field: "autoRenewal" },
      { heading: "Permitted Uses", field: "permittedUses" },
      {
        heading: "Additional Permitted Uses",
        field: "additionalPermittedUses",
      },
      { heading: "License Limits", field: "licenseLimits" },
      { heading: "Warranty Period", field: "warrantyPeriod" },
      { heading: "Deletion Procedure", field: "deletionProcedure" },
      {
        heading: "License Compliance Verification",
        field: "complianceVerification",
      },
      { heading: "Services", field: "services" },
      {
        heading: "Other Changes to Standard Terms",
        hint: "Changes that apply for this Order Form only",
        field: "orderFormChanges",
      },
      {
        heading: "Key Terms",
        hint: "The key legal terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Effective Date",
        hint: "The date the Framework Terms start",
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
        hint: "Claims excluded from any limitation of liability",
        field: "unlimitedClaims",
      },
      {
        heading: "Additional Warranties",
        lines: [
          { label: "By Provider", field: "providerWarranties" },
          { label: "By Customer", field: "customerWarranties" },
        ],
      },
      { heading: "DPA", hint: "Data Processing Agreement", field: "dpa" },
      {
        heading: "Other Changes to Standard Terms",
        hint: "List specific changes to the Standard Terms",
        field: "otherChanges",
      },
    ],
    closing: [
      paragraph(
        bold("Provider"),
        " and ",
        bold("Customer"),
        " have not changed the Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into the Framework Terms and this Order Form."
      ),
    ],
    signatures: ["provider", "customer"],
    signatureRows,
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link(
          "Software License Agreement cover page",
          "https://commonpaper.com/standards/software-license-agreement/"
        ),
        ", free to use under ",
        link("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
        "."
      ),
      paragraph(
        "Common Paper Software License Standard Terms (Version 1.1) free to use under ",
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

    const picked = new Set(values.feeTerms?.selected.map((pick) => pick.option))
    if (picked.has("increaseUpTo") && picked.has("increaseFixed"))
      issue("feeTerms", "Pick one kind of fee increase, not both.")
  },
})
