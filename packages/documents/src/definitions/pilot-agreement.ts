import catalog from "../../generated/catalog.ts"
import template from "../../generated/pilot-agreement.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official Pilot Agreement Order Form v1.1
// (work/PAR-1/cover-pages/pilot-agreement.md has the sources and choices).

const STANDARD_TERMS = "https://commonpaper.com/standards/pilot-agreement/1.1"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const TWELVE_MONTHS_OF_FEES =
  "the Fees paid or payable by Customer to Provider in the 12 month period immediately before the claim"

const multiple = () =>
  field.number({
    label: "Multiple of fees",
    help: "How many times the Fees, like 2 for 2x.",
    min: 0,
    minExclusive: true,
    max: 100,
    decimals: 2,
  })

export const pilotAgreement = defineDocument({
  id: "pilot-agreement",
  version: 1,
  name: catalog["pilot-agreement"].name,
  template,
  fields: {
    product: field.longText({
      label: "Product",
      help: "The product the Customer will try during the pilot.",
    }),
    effectiveDate: field.choice({
      label: "Effective date",
      help: "The date this Pilot Agreement starts.",
      options: {
        lastSignature: { label: "Date of last signature on this Order Form" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Custom start date",
            help: "The day the Pilot Agreement starts.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    pilotPeriod: field.duration({
      label: "Pilot period",
      help: "How long the Customer may use the Product, like 3 months.",
      units: ["days", "weeks", "months", "years"],
    }),
    fees: field.choice({
      label: "Fees",
      help: "What the Customer pays for the pilot, if anything.",
      options: {
        free: { label: "Free Pilot" },
        paid: {
          label: "{value}. Fees are non-refundable and exclusive of taxes.",
          with: field.text({
            label: "Fee details",
            help: "What the Customer pays, like $5,000 for the Pilot Period.",
          }),
        },
      },
    }),
    // Shown only for a paid pilot ("If a free Pilot, delete this row").
    paymentProcess: field.choice({
      label: "Payment process",
      help: "How and when the Customer pays the Fees.",
      optional: true,
      options: {
        invoice: {
          label:
            "Pay by invoice: Customer will pay Fees within {days} days from {start}.",
          blanks: {
            days: field.number({
              label: "Days to pay",
              help: "How many days the Customer has to pay each invoice.",
              min: 1,
              max: 365,
            }),
            start: field.choice({
              label: "Counted from",
              help: "When the days to pay start.",
              options: {
                receipt: { label: "Customer's receipt of invoice" },
                invoiceDate: { label: "the invoice date" },
              },
            }),
          },
        },
        automatic: {
          label:
            "Automatic payment: Customer authorizes Provider to automatically bill and charge the credit card, debit card, or other payment method on file for Fees {cadence} for immediate payment or deduction without further approval. Provider will make a copy of Customer's bills or transaction history available to Customer.",
          blanks: {
            cadence: field.choice({
              label: "Billing cadence",
              help: "How often Provider charges the Customer.",
              options: {
                monthly: { label: "monthly" },
                quarterly: { label: "quarterly" },
                annually: { label: "annually" },
                oncePerPilotPeriod: { label: "once per Pilot Period" },
              },
            }),
          },
        },
      },
    }),
    governingLaw: field.jurisdiction({
      label: "Governing law & courts",
      help: "Whose laws apply, and where disputes are filed.",
      courts: "anywhere",
    }),
    // Required with no default: an empty cap means unlimited liability, and
    // the official default (a multiple of fees) is $0 for a free pilot.
    generalCap: field.choice({
      label: "General cap amount",
      help: "The most either party can owe for most claims.",
      options: {
        multiple: {
          label: `{value}x ${TWELVE_MONTHS_OF_FEES}`,
          with: multiple(),
        },
        fixed: {
          label: "{value}",
          with: field.money({
            label: "Cap amount",
            help: "A fixed amount, like $100,000.",
          }),
        },
        greater: {
          label: `The greater of {amount} or {multiple}x ${TWELVE_MONTHS_OF_FEES}`,
          blanks: {
            amount: field.money({
              label: "Minimum cap",
              help: "The lowest the cap can be, like $100,000.",
            }),
            multiple: multiple(),
          },
        },
      },
    }),
    dpa: field.text({
      label: "DPA",
      help: "Attach or say where to find the data processing agreement.",
      optional: true,
    }),
    technicalSupport: field.longText({
      label: "Technical support",
      help: "What support is included, and how the Customer gets it.",
      optional: true,
    }),
    modifications: field.longText({
      label: "Changes to standard terms",
      help: "List any changes to the Standard Terms.",
      optional: true,
    }),
    provider: field.party({
      label: "Provider",
      help: "The company whose product is being piloted.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company trying the product.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    "Pilot Period": "pilotPeriod",
    "Effective Date": "effectiveDate",
    "General Cap Amount": "generalCap",
    "Governing Law": "governingLaw",
    "Chosen Courts": "governingLaw.courtLocation",
    "Notice Address": ["provider.notice", "customer.notice"],
  },
  coverPage: {
    source: "parley",
    title: "Pilot Agreement Order Form",
    subtitle: "USING THE ORDER FORM",
    intro: [
      paragraph(
        "The Agreement has 2 parts: (1) the Order Form below (including any attached or referenced policies and documents) and (2) the Common Paper Pilot Agreement Standard Terms Version 1.1 posted at ",
        link(STANDARD_TERMS, STANDARD_TERMS),
        ", which are incorporated by reference. If there is any inconsistency between the Order Form and the Standard Terms, the Order Form will control for that inconsistency. Capitalized words have the meanings or descriptions given in the Order Form or Standard Terms. A copy of the Standard Terms is attached for convenience only."
      ),
    ],
    sections: [
      {
        heading: "Order Form",
        hint: "The key business and legal terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Product",
        field: "product",
        template: "The Product available under this Order Form is {value}.",
      },
      {
        heading: "Effective Date",
        hint: "The date the Pilot Agreement starts",
        field: "effectiveDate",
      },
      { heading: "Pilot Period", field: "pilotPeriod" },
      { heading: "Fees", field: "fees" },
      {
        heading: "Payment Process",
        field: "paymentProcess",
        when: { field: "fees", option: "paid" },
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
        template: "The {value}",
      },
      {
        heading: "General Cap Amount",
        hint: "Limitation of liability amount for most claims",
        field: "generalCap",
      },
      { heading: "Attachments, Supplements & Modifications", part: true },
      { heading: "DPA", hint: "Data Processing Agreement", field: "dpa" },
      { heading: "Technical Support", field: "technicalSupport" },
      {
        heading: "Other Changes to Standard Terms",
        hint: "List specific changes to the Standard Terms",
        field: "modifications",
      },
    ],
    closing: [
      paragraph(
        "Provider and Customer have not changed the Standard Terms except for the details in the Order Form above. By signing this Order Form, each party agrees to enter into the Agreement."
      ),
    ],
    signatures: ["provider", "customer"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link(
          "Pilot Agreement Order Form",
          "https://commonpaper.com/standards/pilot-agreement/1.1/cover-page-docx"
        ),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Pilot Agreement Standard Terms (Version 1.1) free to use under ",
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
      issue("customer", "The two parties must be different companies.")

    const cap = values.generalCap
    if (cap?.option === "multiple" && values.fees?.option === "free")
      issue(
        "generalCap",
        "A free pilot has no Fees, so a cap tied to Fees is $0. Pick a dollar amount."
      )
    if (cap?.option === "greater" && cap.value?.multiple === 1)
      issue("generalCap", "Use a multiple other than 1.")
  },
})
