import catalog from "../../generated/catalog.ts"
import template from "../../generated/csa.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { bold, link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official CSA v2.1 cover page: an Order Form and Key
// Terms. Notes, sources and every deviation: work/PAR-1/cover-pages/csa.md.

const OFFICIAL_PAGE =
  "https://commonpaper.com/standards/cloud-service-agreement/"
const STANDARD_TERMS =
  "https://commonpaper.com/standards/cloud-service-agreement/2.1/"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const FEES_TAIL =
  "the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim"

// A pick-list inside an option's sentence. A `choice`, not a `select`: a
// select's options don't fit the AnyField type a blank needs (engine gap).
const frequency = field.choice({
  label: "How often",
  help: "How often the customer is billed.",
  options: {
    monthly: { label: "monthly" },
    quarterly: { label: "quarterly" },
    annually: { label: "annually" },
    subscriptionPeriod: { label: "once per Subscription Period" },
  },
})
const dollars = (label: string, help: string) => field.money({ label, help })
const feeMultiple = (min: number, help: string) =>
  field.number({
    label: "Fee multiple",
    help,
    min,
    minExclusive: true,
    max: 100,
    decimals: 2,
  })
const limits = (occurrence: string, aggregate: string) => ({
  occurrence: dollars(occurrence, "The minimum limit for each occurrence."),
  aggregate: dollars(aggregate, "The minimum limit in the aggregate."),
})

// The claim lists are shared by Increased Claims and Unlimited Claims, in
// the order each official row prints them.
const claim = {
  privacy: { label: "Breach of Section 3 (Privacy & Security)" },
  confidentiality: {
    label:
      "Breach of Section 10 (Confidentiality) (however, excluding any data or security breaches)",
  },
  indemnification: {
    label: "An Indemnifying Party’s indemnification obligation",
  },
  privacyGross: {
    label:
      "Breach of Section 3 (Privacy & Security) resulting from gross negligence or willful misconduct",
  },
  confidentialityGross: {
    label:
      "Breach of Section 10 (Confidentiality) resulting from gross negligence or willful misconduct (however, excluding any data or security breaches)",
  },
}

export const csa = defineDocument({
  id: "csa",
  version: 1,
  name: catalog.csa.name,
  template,
  fields: {
    // --- Order Form ---
    cloudService: field.longText({
      label: "Description of the product",
      help: "What the customer gets access to.",
    }),
    orderDate: field.choice({
      label: "Order date",
      help: "When the customer's access starts.",
      options: {
        lastSignature: { label: "Date of last signature on this Order Form" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Custom start date",
            help: "The day access starts.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    pilot: field.choice({
      label: "Pilot",
      help: "A trial before the paid subscription starts, if any.",
      options: {
        none: { label: "None" },
        pilot: {
          label:
            "Customer may access the Cloud Service for a limited {length} trial (“Pilot Period”). The Subscription Period will automatically start following the Pilot Period. {fee}",
          blanks: {
            length: field.duration({
              label: "Length of pilot",
              help: "How long the trial lasts.",
              units: ["days", "weeks", "months"],
            }),
            // A choice inside the sentence: required once a pilot is picked.
            fee: field.choice({
              label: "Pilot fee",
              help: "Whether the pilot costs money, and how much.",
              options: {
                paid: {
                  label: "Fee for Pilot Period: {value}",
                  with: dollars("Pilot fee", "What the pilot costs."),
                },
                free: { label: "Free trial" },
              },
            }),
          },
        },
      },
    }),
    pilotModifications: field.longText({
      label: "Pilot modifications",
      help: "Terms that change only during the pilot. Leave empty if none.",
      optional: true,
    }),
    subscriptionPeriod: field.duration({
      label: "Length of access",
      help: "How long each paid term lasts.",
      units: ["days", "weeks", "months", "years"],
    }),
    fees: field.choices({
      label: "Cloud service fees",
      help: "What the customer pays.",
      options: {
        perUnit: {
          label: "{amount} per {unit}",
          blanks: {
            amount: dollars("Amount", "The price per unit."),
            unit: field.text({
              label: "Unit",
              help: "Year, month, Subscription Period, User, gigabyte, and so on.",
            }),
          },
        },
        otherStructure: {
          label: "Other fee structure: {value}",
          with: field.longText({
            label: "Fee structure",
            help: "How fees are worked out, in plain words.",
          }),
        },
      },
    }),
    feeChanges: field.choices({
      label: "Fee changes",
      help: "Renewal increases, and whether fees include taxes.",
      optional: true,
      options: {
        mayIncrease: {
          label: "Fees may increase up to {value} per renewal.",
          with: field.percent({
            label: "Maximum increase",
            help: "The most fees may rise at each renewal.",
          }),
        },
        willIncrease: {
          label: "Fees will increase {value} per renewal.",
          with: field.percent({
            label: "Increase",
            help: "How much fees rise at each renewal.",
          }),
        },
        taxInclusive: {
          label:
            "Modifying Section 4.1 of the Standard Terms, Fees are inclusive of taxes.",
        },
      },
    }),
    paymentProcess: field.choice({
      label: "Payment process",
      help: "How billing and payment work.",
      options: {
        invoice: {
          label:
            "Pay by invoice: Provider will invoice Customer {frequency}. Customer will pay each invoice within {days} days from {start}.",
          blanks: {
            frequency,
            days: field.number({
              label: "Days to pay",
              help: "How many days the customer has to pay.",
              min: 1,
              max: 365,
            }),
            start: field.choice({
              label: "Counted from",
              help: "When the days to pay start counting.",
              options: {
                receipt: { label: "Customer’s receipt of invoice" },
                invoiceDate: { label: "the invoice date" },
              },
            }),
          },
        },
        automatic: {
          label:
            "Automatic payment: Customer authorizes Provider to bill and charge Customer’s payment method on file {frequency} for immediate payment or deduction without further approval.",
          blanks: { frequency },
        },
      },
    }),
    renewal: field.choice({
      label: "Auto-renewal",
      help: "Whether the order renews, and the notice needed to stop it.",
      options: {
        autoRenew: {
          label:
            "Non-Renewal Notice Date: At least {value} days before the end of the current Subscription Period",
          with: field.number({
            label: "Number of days",
            help: "How many days' notice stops the renewal.",
            min: 1,
            max: 365,
          }),
        },
        noRenewal: {
          label:
            "Modifying Section 5.1 of the Standard Terms, this Order Form does not automatically renew and will expire at the end of the Subscription Period.",
        },
      },
      default: { option: "autoRenew" },
    }),
    useLimitations: field.choice({
      label: "Use limitations",
      help: "Limits on how the product may be used.",
      options: {
        none: { label: "None" },
        described: {
          label: "{value}",
          with: field.longText({
            label: "Use limitations",
            help: "Such as geographic restrictions or system requirements.",
          }),
        },
      },
    }),
    technicalSupport: field.choice({
      label: "Technical support",
      help: "What support the customer gets, and how to ask for it.",
      options: {
        none: { label: "None" },
        described: {
          label: "{value}",
          with: field.longText({
            label: "Technical support",
            help: "Included support and how the customer can get it.",
          }),
        },
      },
    }),
    sla: field.choice({
      label: "SLA",
      help: "The service level the provider promises.",
      options: {
        none: { label: "None" },
        basic: {
          label:
            "Provider will use commercially reasonable efforts to provide and maintain the Cloud Service without excessive errors and interruptions. If Provider does not meet the SLA in two consecutive months or over three months in any 12-month period, then Customer may, as its only remedy, terminate this Order Form upon notice and receive a prorated refund of prepaid Fees for the remainder of the Subscription Period.",
        },
        custom: {
          label: "{value}",
          with: field.longText({
            label: "SLA terms",
            help: "Your own service levels, or where to find them.",
          }),
        },
      },
    }),
    professionalServices: field.choices({
      label: "Professional services",
      help: "Services beyond the Cloud Service, like setup or training.",
      exclusive: ["none"],
      options: {
        none: { label: "None" },
        reference: {
          label:
            "Provider will provide professional services according to the {value}.",
          with: field.text({
            label: "SOW or PSA",
            help: "The attached SOW, or the PSA it refers to.",
          }),
        },
        described: {
          label:
            "Provider will provide the following professional services: {value}",
          with: field.longText({
            label: "Services",
            help: "The services, including any fees for them.",
          }),
        },
        payment: {
          label: "Payment Process for these services: {value}",
          with: field.longText({
            label: "Services billing",
            help: "How service fees are billed.",
          }),
        },
      },
    }),
    orderFormChanges: field.longText({
      label: "Order form changes",
      help: "Changes for this Order Form only. Leave empty if none.",
      optional: true,
    }),

    // --- Key Terms ---
    effectiveDate: field.choice({
      label: "Effective date",
      help: "When these legal terms start. Often the Order Date.",
      options: {
        lastSignature: { label: "Date of last Cover Page signature" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Custom effective date",
            help: "The day the legal terms start.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    // The terms name "Chosen Courts" on their own and never say "the State
    // of", so courts may sit anywhere and the place may be outside the US.
    governingLaw: field.jurisdiction({
      label: "Governing law",
      help: "Whose laws apply, and where disputes are filed.",
      courts: "anywhere",
    }),
    providerCoveredClaims: field.choice({
      label: "Provider covered claims",
      help: "Claims the provider defends the customer against.",
      options: {
        none: { label: "None" },
        standard: {
          label:
            "Any action, proceeding, or claim that the Cloud Service, when used by Customer according to the terms of the Agreement, violates, misappropriates, or otherwise infringes upon anyone else’s intellectual property or other proprietary rights.",
        },
        custom: {
          label: "{value}",
          with: field.longText({
            label: "Provider covered claims",
            help: "The claims, in your own words.",
          }),
        },
      },
      default: { option: "standard" },
    }),
    customerCoveredClaims: field.choice({
      label: "Customer covered claims",
      help: "Claims the customer defends the provider against.",
      options: {
        none: { label: "None" },
        standard: {
          label:
            "Any action, proceeding, or claim that (1) the Customer Content, when used according to the terms of the Agreement, violates, misappropriates, or otherwise infringes upon anyone else’s intellectual property or other proprietary rights; or (2) results from Customer’s breach or alleged breach of Section 2.1 (Restrictions on Customer).",
        },
        custom: {
          label: "{value}",
          with: field.longText({
            label: "Customer covered claims",
            help: "The claims, in your own words.",
          }),
        },
      },
      default: { option: "standard" },
    }),
    // Required: leaving it out means no cap at all, not $0 (official note).
    generalCapAmount: field.choice({
      label: "General cap amount",
      help: "The most either side can owe for most claims.",
      options: {
        multiple: {
          label: `{value}x ${FEES_TAIL}`,
          with: feeMultiple(0, "The multiple of a year's fees, like 1 or 2."),
        },
        fixed: {
          label: "{value}",
          with: dollars("Dollar amount", "A fixed cap, like $1,000,000."),
        },
        greater: {
          label: `The greater of {amount} or {multiple}x ${FEES_TAIL}`,
          blanks: {
            amount: dollars("Dollar amount", "The fixed part of the cap."),
            multiple: feeMultiple(
              0,
              "The multiple of a year's fees, like 1 or 2."
            ),
          },
        },
      },
      default: { option: "multiple" },
    }),
    increasedClaims: field.choices({
      label: "Increased claims",
      help: "Claims with a higher cap than the general one.",
      exclusive: ["none"],
      allowOther: true,
      longOther: true,
      options: {
        none: { label: "None" },
        privacy: claim.privacy,
        confidentiality: claim.confidentiality,
        indemnification: claim.indemnification,
        privacyGross: claim.privacyGross,
        confidentialityGross: claim.confidentialityGross,
      },
      default: {
        selected: [{ option: "privacy" }, { option: "confidentiality" }],
      },
    }),
    increasedCapAmount: field.choice({
      label: "Increased cap amount",
      help: "The higher cap for Increased Claims, often called a supercap.",
      options: {
        none: { label: "None" },
        multiple: {
          label: `{value}x ${FEES_TAIL}`,
          with: feeMultiple(
            1,
            "A multiple above 1x, and above the general cap's."
          ),
        },
        fixed: {
          label: "{value}",
          with: dollars("Dollar amount", "A fixed supercap, like $3,000,000."),
        },
        greater: {
          label: `The greater of {amount} or {multiple}x ${FEES_TAIL}`,
          blanks: {
            amount: dollars("Dollar amount", "The fixed part of the supercap."),
            multiple: feeMultiple(
              1,
              "A multiple above 1x, and above the general cap's."
            ),
          },
        },
      },
      default: { option: "multiple" },
    }),
    unlimitedClaims: field.choices({
      label: "Unlimited claims",
      help: "Claims with no cap at all. Rare.",
      exclusive: ["none"],
      allowOther: true,
      longOther: true,
      options: {
        none: { label: "None" },
        indemnification: claim.indemnification,
        privacyGross: claim.privacyGross,
        confidentialityGross: claim.confidentialityGross,
        privacy: claim.privacy,
        confidentiality: claim.confidentiality,
      },
      default: { selected: [{ option: "indemnification" }] },
    }),
    additionalWarranties: field.choices({
      label: "Additional warranties",
      help: "Extra promises either side makes.",
      exclusive: ["none"],
      options: {
        none: { label: "None" },
        provider: {
          label: "By Provider: {value}",
          with: field.longText({
            label: "Provider warranties",
            help: "What the provider promises.",
          }),
        },
        customer: {
          label: "By Customer: {value}",
          with: field.longText({
            label: "Customer warranties",
            help: "What the customer promises.",
          }),
        },
      },
    }),
    dpa: field.choice({
      label: "DPA",
      help: "Your data processing agreement, if you have one.",
      options: {
        none: { label: "None" },
        provided: {
          label: "{value}",
          with: field.text({
            label: "Where to find the DPA",
            help: "Attach it, or say where to find it.",
          }),
        },
      },
    }),
    securityPolicy: field.choices({
      label: "Security policy",
      help: "How the provider keeps the Cloud Service secure.",
      exclusive: ["none"],
      options: {
        none: { label: "None" },
        reasonableEfforts: {
          label:
            "Provider will use commercially reasonable efforts to secure the Cloud Service from unauthorized access, alteration, or use and other unlawful tampering.",
        },
        policy: {
          label:
            "Provider will comply with the Security Policy available at {value}.",
          with: field.text({
            label: "Where to find it",
            help: "A link, or where the policy is attached.",
          }),
        },
        certifications: {
          label:
            "Provider will maintain annually updated reports or annual certifications of compliance with the following: {value}",
          with: field.choices({
            label: "Certifications",
            help: "The reports or certifications the provider keeps current.",
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
        },
      },
      default: { selected: [{ option: "reasonableEfforts" }] },
    }),
    insurance: field.choice({
      label: "Insurance minimums",
      help: "Whether the provider must carry set insurance.",
      options: {
        none: { label: "None" },
        required: {
          label:
            "During the Subscription Period and for six months after, Provider will carry commercial insurance policies with coverage limits that meet the Insurance Minimums below: {value}",
          with: field.choices({
            label: "Coverage limits",
            help: "The insurance the provider must carry, and its limits.",
            options: {
              generalLiability: {
                label:
                  "Commercial general liability with a minimum limit for each occurrence of at least {occurrence} and at least {aggregate} in the aggregate",
                blanks: limits(
                  "General liability, each",
                  "General liability, total"
                ),
              },
              workersCompensation: {
                label:
                  "Workers’ compensation or employers’ liability insurance as required by Applicable Laws",
              },
              professionalLiability: {
                label:
                  "Errors and omissions or professional liability with a minimum limit for each occurrence of at least {occurrence} and at least {aggregate} in the aggregate",
                blanks: limits(
                  "Professional liability, each",
                  "Professional liability, total"
                ),
              },
              cyber: {
                label:
                  "Cyber liability insurance with a minimum limit for each occurrence of at least {occurrence} and at least {aggregate} in the aggregate",
                blanks: limits(
                  "Cyber liability, each",
                  "Cyber liability, total"
                ),
              },
            },
          }),
        },
      },
    }),
    additionalInsured: field.choices({
      label: "Additional insured",
      help: "Provider policies that also cover the customer.",
      optional: true,
      options: {
        generalLiability: { label: "Commercial general liability" },
        professionalLiability: {
          label: "Errors and omissions or professional liability",
        },
        cyber: { label: "Cyber liability" },
      },
    }),
    keyTermsChanges: field.longText({
      label: "Key terms changes",
      help: "Changes to the standard terms. Leave empty if none.",
      optional: true,
    }),

    provider: field.party({
      label: "Provider",
      help: "The company selling the Cloud Service.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company buying the Cloud Service.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    "Subscription Period": "subscriptionPeriod",
    "Subscription Periods": "subscriptionPeriod",
    "Technical Support": "technicalSupport",
    "Use Limitations": "useLimitations",
    DPA: "dpa",
    "Payment Process": "paymentProcess",
    "Order Date": "orderDate",
    "Non-Renewal Notice Date": "renewal",
    "Effective Date": "effectiveDate",
    "Additional Warranties": "additionalWarranties",
    "General Cap Amount": "generalCapAmount",
    "Increased Claims": "increasedClaims",
    "Increased Cap Amount": "increasedCapAmount",
    "Unlimited Claims": "unlimitedClaims",
    "Provider Covered Claims": "providerCoveredClaims",
    "Provider Covered Claim": "providerCoveredClaims",
    "Customer Covered Claims": "customerCoveredClaims",
    "Customer Covered Claim": "customerCoveredClaims",
    "Governing Law": "governingLaw",
    "Chosen Courts": "governingLaw.courtLocation",
  },
  coverPage: {
    source: "parley",
    title: "Cloud Service Agreement",
    intro: [
      paragraph(
        "This Order Form incorporates and is governed by the Framework Terms included below. If there is any inconsistency between this Order Form and the Framework Terms, this Order Form will control for this Agreement."
      ),
      paragraph(
        "The Framework Terms have 2 parts: (1) the Key Terms below (including any attached or referenced policies and documents) and (2) the Common Paper Cloud Service Agreement Standard Terms Version 2.1 posted at ",
        link(
          "commonpaper.com/standards/cloud-service-agreement/2.1",
          STANDARD_TERMS
        ),
        ", which are incorporated by reference. If there is any inconsistency between the parts of the Framework Terms, the Key Terms will control over the Standard Terms. Capitalized words have the meanings or descriptions given in the Cover Page or Standard Terms. A copy of the Standard Terms is attached for convenience only."
      ),
    ],
    sections: [
      { heading: "Order Form", part: true },
      {
        heading: "Cloud Service",
        field: "cloudService",
        template:
          "The Cloud Service available under this Order Form is {value}.",
      },
      {
        heading: "Order Date",
        hint: "The date access to the Cloud Service starts",
        field: "orderDate",
      },
      { heading: "Pilot", field: "pilot" },
      {
        heading: "Pilot Period Modifications",
        hint: "Modifications to the Agreement that apply only to the Pilot Period",
        when: { field: "pilot", option: "pilot" },
        field: "pilotModifications",
      },
      { heading: "Subscription Period", field: "subscriptionPeriod" },
      { heading: "Cloud Service Fees", field: "fees" },
      { heading: "Fee Changes", field: "feeChanges" },
      { heading: "Payment Process", field: "paymentProcess" },
      { heading: "Auto-renewal", field: "renewal" },
      { heading: "Use Limitations", field: "useLimitations" },
      { heading: "Technical Support", field: "technicalSupport" },
      { heading: "SLA", hint: "Service Level Agreement", field: "sla" },
      {
        heading: "Professional Services",
        hint: "Customer will reasonably cooperate with Provider to allow the performance of the services described below, including providing Customer Content as needed. Provider is not responsible for any inability to perform these services if Customer does not cooperate as reasonably requested.",
        field: "professionalServices",
      },
      {
        heading: "Other Changes to Standard Terms",
        hint: "Changes that apply for this Order Form only",
        field: "orderFormChanges",
      },
      { heading: "Key Terms", part: true },
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
      { heading: "Additional Warranties", field: "additionalWarranties" },
      { heading: "DPA", hint: "Data Processing Agreement", field: "dpa" },
      { heading: "Security Policy", field: "securityPolicy" },
      { heading: "Insurance Minimums", field: "insurance" },
      {
        heading: "Additional Insured",
        hint: "Upon request, Provider will give Customer a certificate of insurance evidencing its insurance policies that meet the Insurance Minimums. Provider’s insurance policies will not be considered as evidence of Provider’s liability. The following of Provider’s policies will cover Customer as additional insured:",
        when: { field: "insurance", option: "required" },
        field: "additionalInsured",
      },
      {
        heading: "Other Changes to Standard Terms",
        hint: "List specific changes to the Standard Terms",
        field: "keyTermsChanges",
      },
    ],
    // One signature block signs both parts, so the two official closings
    // become one.
    closing: [
      paragraph(
        bold("Provider"),
        " and ",
        bold("Customer"),
        " have not changed the Standard Terms except for the details in the Key Terms above. By signing this Cover Page, each party agrees to enter into the Framework Terms and this Order Form."
      ),
    ],
    signatures: ["provider", "customer"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link("Cloud Service Agreement cover page", OFFICIAL_PAGE),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Cloud Service Agreement Standard Terms (Version 2.1) free to use under ",
        link("CC BY 4.0", CC_BY),
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
      issue(
        "customer",
        "The provider and the customer must be different companies."
      )

    const feeChanges = new Set(
      values.feeChanges?.selected.map((pick) => pick.option)
    )
    if (feeChanges.has("mayIncrease") && feeChanges.has("willIncrease"))
      issue("feeChanges", "Pick one kind of fee increase, not both.")

    // Each rule below blocks a contradiction only, never a missing value, so
    // the rows can be filled in any order.
    const increased = values.increasedClaims
    const cap = values.increasedCapAmount
    const hasIncreased =
      increased !== undefined &&
      (increased.other !== undefined ||
        increased.selected.some((pick) => pick.option !== "none"))
    // Otherwise the Increased Claims would have no cap at all (8.1(b)).
    if (hasIncreased && cap?.option === "none")
      issue(
        "increasedCapAmount",
        "Increased Claims need a cap. Pick an Increased Cap Amount, or set Increased Claims to None."
      )

    // 8.4 would put one claim under the supercap and under no cap at once.
    const unlimited = new Set(
      values.unlimitedClaims?.selected.map((pick) => pick.option)
    )
    for (const pick of increased?.selected ?? [])
      if (pick.option !== "none" && unlimited.has(pick.option))
        issue(
          "increasedClaims",
          `“${claim[pick.option].label}” can't be both an Increased Claim and an Unlimited Claim.`
        )

    const general = values.generalCapAmount
    if (
      general?.option === "multiple" &&
      cap?.option === "multiple" &&
      general.value !== undefined &&
      cap.value !== undefined &&
      cap.value <= general.value
    )
      issue(
        "increasedCapAmount",
        "The Increased Cap Amount must be more than the General Cap Amount."
      )
  },
})
