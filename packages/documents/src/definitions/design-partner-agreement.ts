import catalog from "../../generated/catalog.ts"
import template from "../../generated/design-partner-agreement.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { bold, link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official Design Partner Agreement cover page v1.3
// (work/PAR-1/cover-pages/design-partner-agreement.md has the sources).

const STANDARD_TERMS =
  "https://commonpaper.com/standards/design-partner-agreement/1.3"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

/** The official "[ month | quarter | year | term ]" pick. */
const period = (help: string) =>
  field.select({
    label: "Period",
    help,
    options: { month: "month", quarter: "quarter", year: "year", term: "term" },
  })

export const designPartnerAgreement = defineDocument({
  id: "design-partner-agreement",
  version: 1,
  name: catalog["design-partner-agreement"].name,
  template,
  fields: {
    product: field.longText({
      label: "Product",
      help: "The product being developed, with a short description.",
    }),
    programPartner: field.choices({
      label: "Partner will",
      help: "What the Partner does in the design partner program.",
      options: {
        feedback: {
          label: "Participate in {sessions} Feedback sessions per {period}",
          blanks: {
            sessions: field.number({
              label: "Feedback sessions",
              help: "How many feedback sessions per period.",
              min: 1,
              max: 100,
            }),
            period: period("How often the sessions repeat."),
          },
        },
        caseStudy: {
          label: "Provide case study that can be shared with others",
        },
        privateLists: {
          label: "Appear as a customer in private customer lists",
        },
        publicLists: {
          label:
            "Appear as a customer on Provider’s website and public customer lists",
        },
        reference: { label: "Serve as a reference for prospective customers" },
      },
      allowOther: true,
    }),
    programProvider: field.choices({
      label: "Provider will",
      help: "What the Provider gives the Partner in return.",
      options: {
        discount: {
          label:
            "Give a {value} discount to Partner if Partner signs a long-term customer agreement for the Product after completing the Program",
          with: field.text({
            label: "Discount",
            help: "A flat amount or a percentage, like 20%.",
          }),
        },
        functionality: {
          label: "Develop the following Product functionality: {value}",
          with: field.longText({
            label: "Functionality",
            help: "The features the Provider will build.",
          }),
        },
        none: { label: "None" },
      },
      allowOther: true,
      exclusive: ["none"],
    }),
    // The official page offers only this option.
    effectiveDate: field.choice({
      label: "Effective date",
      help: "The date this Agreement starts.",
      options: {
        lastSignature: { label: "Date of last Cover Page signature" },
      },
      default: { option: "lastSignature" },
    }),
    term: field.duration({
      label: "Term",
      help: "How long the Agreement and the program last.",
      units: ["months", "quarters", "years"],
    }),
    // The official page says "The laws of the State of", so a US state only.
    governingLaw: field.jurisdiction({
      label: "Governing law & courts",
      help: "Which state's laws apply, and where disputes are filed.",
      usOnly: true,
      courts: "anywhere",
    }),
    fees: field.choice({
      label: "Fees",
      help: "What the Partner pays to use the Product, if anything.",
      options: {
        paid: {
          label:
            "During the Term, Partner will pay Provider {amount} per {period} (excluding taxes) in U.S. Dollars to access and use the Product. This amount reflects a discount for Partner’s Feedback and participation in the Program. Partner will pay the fee within {days} days from receipt of invoice.",
          blanks: {
            amount: field.money({
              label: "Fee",
              help: "The discounted fee, in U.S. Dollars.",
            }),
            period: period("How often the fee is due."),
            days: field.number({
              label: "Days to pay",
              help: "How many days the Partner has to pay each invoice.",
              min: 1,
              max: 365,
            }),
          },
        },
        none: { label: "There are no Fees under this Agreement." },
      },
    }),
    modifications: field.longText({
      label: "Changes to standard terms",
      help: "List any changes to the Standard Terms.",
      optional: true,
    }),
    provider: field.party({
      label: "Provider",
      help: "The company building the product.",
    }),
    partner: field.party({
      label: "Partner",
      help: "The early user giving feedback on the product.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Partner: "partner.company",
    Program: ["programPartner", "programProvider"],
    Term: "term",
    Fees: "fees",
    "Effective Date": "effectiveDate",
    "Governing Law": "governingLaw",
    "Chosen Courts": "governingLaw.courtLocation",
    "Notice Address": ["provider.notice", "partner.notice"],
  },
  coverPage: {
    source: "parley",
    title: "Design Partner Agreement",
    subtitle: "USING THIS AGREEMENT",
    intro: [
      paragraph(
        "This Agreement has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common Paper Design Partner Standard Terms Version 1.3 posted at ",
        link(
          "commonpaper.com/standards/design-partner-agreement/1.3",
          STANDARD_TERMS
        ),
        " (“",
        bold("Standard Terms"),
        "”), which is incorporated by reference. If there is any inconsistency between the parts of the Agreement, the Cover Page will control over the Standard Terms. Capitalized and highlighted words have the meanings given on the Cover Page. However, if the Cover Page omits or does not define a highlighted word, the default meaning will be “none” or “not applicable” and the correlating clause, sentence, or section does not apply to this Agreement. All other capitalized words have the meanings given in the Standard Terms."
      ),
    ],
    sections: [
      {
        heading: "Key Terms",
        hint: "The key legal terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Product",
        field: "product",
        template: "The Product is {value}.",
      },
      {
        heading: "Program",
        hint: "As part of the Program, Partner will:",
        field: "programPartner",
      },
      {
        heading: "Program",
        hint: "As part of the Program, Provider will:",
        field: "programProvider",
      },
      {
        heading: "Effective Date",
        hint: "The date the Agreement starts",
        field: "effectiveDate",
      },
      { heading: "Term", field: "term" },
      {
        heading: "Governing Law",
        field: "governingLaw",
        template: "The laws of the State of {value}",
      },
      {
        heading: "Chosen Courts",
        hint: "Jurisdiction or where disputes are filed",
        field: "governingLaw.courtLocation",
        template: "The state and federal {value}",
      },
      { heading: "Fees", field: "fees" },
      {
        heading: "Other Changes to Standard Terms",
        hint: "List specific changes to the Standard Terms",
        field: "modifications",
      },
    ],
    closing: [
      paragraph(
        "Provider and Partner have not changed the Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this Agreement as of the Effective Date."
      ),
    ],
    signatures: ["provider", "partner"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link(
          "Design Partner Agreement cover page",
          "https://commonpaper.com/standards/design-partner-agreement/1.3/cover-page-docx"
        ),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Design Partner Standard Terms (Version 1.3) free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
    ],
  },
  rules: (values, issue) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const provider = company(values.provider?.company)
    if (provider !== undefined && provider === company(values.partner?.company))
      issue("partner", "The two parties must be different companies.")

    // The official Fees line says "in U.S. Dollars", kept word for word.
    const fees = values.fees
    const currency =
      fees?.option === "paid" ? fees.value?.amount?.currency : undefined
    if (currency !== undefined && currency !== "USD")
      issue("fees", "The Fees line says U.S. Dollars, so use USD.")
  },
})
